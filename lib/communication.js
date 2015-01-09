var events = require('events');
var zmq = require('zmq');
var zonar = require('zonar');

// configs
var email = 'prod@24hr.se';
var port = 5999;
var address = "tcp://0:" + port;
var rPort = 5998;
var rAddress = "tcp://0:" + rPort;

// setup
var broadcaster = zonar.create({ net: '24hr', name: 'google.breakfast' });
broadcaster.payload = { 'pub': port, 'req': rPort };

// Create sockets
var socket = zmq.socket('pub');
var rSocket = zmq.socket('rep');

// For getting the info about the tokens from google-auth
var sSocket = zmq.socket('sub');
var reqSocket = zmq.socket('req');

var communication = {};
events.EventEmitter.call(communication);
communication.__proto__ = events.EventEmitter.prototype;

communication.init = function(options) {

    console.log('Starting');

    rSocket.bindSync(rAddress);

    console.log('Bindend response socket');

    rSocket.on('message', function(dataBuffer) {
        console.log("Got request for current breakfaster");
        var breakFaster = options.getBreakfaster();
        socket.send(breakFaster);
    });

    socket.bind(address, function(err) {

        console.log('Bindend publishing socket');

        if (err) { throw err; }

        broadcaster.start(function() {

            console.log('Started zonar');
            
            broadcaster.on('found.google-tokens', function(service) {

		console.log('Found google-tokens service');
               
                var address = 'tcp://' + service.address + ':' + service.payload.rep;
                reqSocket.connect(address);
                reqSocket.on('message', function(message) {
                    var data = JSON.parse(message.toString());
                    communication.emit('token', data);
                    reqSocket.close();
                });
                reqSocket.send(email);

                sSocket.connect('tcp://' + service.address + ':' + service.payload.pub);
                sSocket.subscribe(email);
                sSocket.on('message', function(message) {
                    var data = JSON.parse(message.toString().replace(email + ' ', ''));
                    communication.emit('token', data);
                });

            });

        });
    });

    // Greacefully quit
    process.on('SIGINT', function() {
        console.log("");
        broadcaster.stop(function() {
            console.log("Zonar has stoped");
            socket.close(function() { });
            process.exit(0);
        });
    });

};

communication.publish = function(message) {
    console.log('Publish ' + message);
    socket.send('all ' + message);
};

module.exports = communication;
