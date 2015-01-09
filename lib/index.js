var communication = require('./communication');
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var calendar = google.calendar('v3');

var calendarId = '24hr.se_rc01dgqeash999urj6t05709e0@group.calendar.google.com';
var timeToReload = 1000 * 60 * 10;
var retryErrors = 0;
var lastBreakfaster = 'none-set';

var oauth2Client, timeoutRef;

function getCalendar() {

    if (oauth2Client) {

        var now = new Date();

        var options = { 
            orderBy: "starttime", 
            singleEvents : true, 
            timeMin: now.toISOString(), 
            calendarId: calendarId, 
            auth: oauth2Client 
        };

        calendar.events.list(options, function(err, response) {

            if (!err) {

                retryErrors = 0;

                var items = response.items;
                var breakfastList = items.map(function(item) {
                    return {
                        start: new Date(item.start.date),
                        title: item.summary
                    };
                }).filter(function(item) {
                    return !(item.start.getDate() === now.getDate() && now.getHours() > 12);
                });

                if (breakfastList.length > 0) {
                    var nextBreakfaster = breakfastList.shift().title;
                    if (nextBreakfaster !== lastBreakfaster) {
                        communication.publish(nextBreakfaster);
                        lastBreakfaster = nextBreakfaster;
                    }
                } else {
                    communication.publish('no-entries');
                }

            } else {

                console.log("ERROR", err);
                retryErrors++;
                communication.publish('error ' + retryErrors);

            }

            clearTimeout(timeoutRef);
            setTimeout(getCalendar, timeToReload);

        });

    }

}

function getBreakfaster() {
    return lastBreakfaster;
}

communication.on('token', function(e) {

    console.log('Got auth tokens');

    oauth2Client = new OAuth2(e.id, e.secret, e.callback);
    oauth2Client.setCredentials({
        access_token: e.accessToken,
        refresh_token: e.refreshToken,
    });

    clearTimeout(timeoutRef);
    getCalendar();
    
});

communication.init();
