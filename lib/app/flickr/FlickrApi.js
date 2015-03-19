var flickrApi = require('flickr-oauth-and-upload');
var flickr = require('flickr-with-uploads');
//var gui = require('nw.gui');

var consumerKey,
    consumerKeySecret,
    oauthToken,
    oauthTokenSecret,
    oauthVerifier,
    conf,
    api;


function getApi(options, conf, callback, thisp) {

    if (typeof  api != "function") {
        function onCredentials(credentials) {


            api = flickr(
                credentials.consumerKey,
                credentials.consumerKeySecret,
                credentials.oAccessAuthToken,
                credentials.oAccessAuthTokenSecret
            );
            onApi();
        }

        getCredentials(conf, onCredentials, this)


    } else {
        onApi();
    }

    function onApi() {
        api(options, function (err, response) {
            if (err) {
                callback.call(thisp, err);
            }
            callback.call(thisp, null, response);
        })
    }
}
function getCredentials(con, callback, thisp) {
    conf = con;
    var config = conf.getConfig();

    if (typeof config.flickr == "undefined" || !config.flickr.hasOwnProperty('consumerKey') || !config.flickr.hasOwnProperty('consumerKeySecret')) {
        throw new Error('nor flickr.consumerKey or flickr.consumerKey found in config');
    } else {
        consumerKey = config.flickr.consumerKey;
        consumerKeySecret = config.flickr.consumerKeySecret;
    }

    if (!config.flickr.hasOwnProperty('oauthToken') || !config.flickr.hasOwnProperty('oauthTokenSecret') || !config.flickr.hasOwnProperty('oauthVerifier')) {
        getRequestToken(callback, thisp);

    } else {
        oauthToken = config.flickr.oauthToken;
        oauthTokenSecret = config.flickr.oauthTokenSecret;
        oauthVerifier = config.flickr.oauthVerifier;

        getAccessToken(callback, thisp);
    }


}
function getRequestToken(callback, thisp) {

    var config = conf.getConfig();

    var myCallback = function (err, data) {
        if (!err) {
            /*console.log('Remember the credentials:');
            console.log('oauthToken: ' + data.oauthToken);
            console.log('oauthTokenSecret: ' + data.oauthTokenSecret);
            console.log('Ask user to go here for authorization: ' + data.url);
*/

            config.flickr.oauthToken = data.oauthToken;
            config.flickr.oauthTokenSecret = data.oauthTokenSecret;
            oauthToken = data.oauthToken;
            oauthTokenSecret = data.oauthTokenSecret;

        } else {
            console.log('Error: ' + err);
        }

        var gui = global.nwGui;

        var current = gui.Window.get();
        var currentW = current.window;

        var new_win = gui.Window.open(data.url, {
            position: 'center',
            width: 975,
            height: 640
        });
        new_win.on('loaded', function () {

            this.focus();

            currentW.console.log('loaded');
            var location = this.window.location.href;
            currentW.console.log(location);

            var marker = 'oauth_verifier';

            var pos = location.indexOf(marker);

            if (pos > -1) {
                currentW.console.log('pos: ' + pos);

                var parts = location.split('&');
                currentW.console.log(parts);

                parts.forEach(function (item) {
                    var pos1 = item.indexOf(marker);
                    if (pos1 > -1) {
                        currentW.console.log(item);
                        oauthVerifier = item.substring(pos1 + marker.length + 1);
                        currentW.console.log(oauthVerifier);

                        config.flickr.oauthVerifier = oauthVerifier;

                        currentW.console.log(config);

                        conf.writeConfig();

                        new_win.close();
                        current.focus();

                        getAccessTocken(callback, thisp);
                    }
                })


            } else {
                currentW.console.log('pos: ' + pos);
            }

        });

    };
    var args = {
        flickrConsumerKey: consumerKey,
        flickrConsumerKeySecret: consumerKeySecret,
        permissions: 'write',
        redirectUrl: '"app://flickr/lib/view/access.html"',
        callback: myCallback
    };

    flickrApi.getRequestToken(args);
}
function getAccessToken(callback, thisp) {

    var config = conf.getConfig();


    var myCallback = function (err, data) {
        if (!err) {
            // Now we have received authorized versions of
            // oauth token and oauth token secret
            /*console.log('oauthToken: ' + data.oauthToken);
            console.log('oauthTokenSecret: ' + data.oauthTokenSecret);
            console.log('userNsId: ' + data.userNsId);
            console.log('userName: ' + data.userName);
            console.log('fullName: ' + data.fullName);*/

            config.flickr.oAccessAuthToken = data.oauthToken;
            config.flickr.oAccessAuthTokenSecret = data.oauthTokenSecret;
            config.flickr.userNsId = data.userNsId;
            config.flickr.userName = data.userName;
            config.flickr.fullName = data.fullName;

            conf.writeConfig();

            callback.call(thisp, config.flickr);


        } else {
            console.log('error: ' + err);
        }
    };

    var args = {
        flickrConsumerKey: consumerKey,
        flickrConsumerKeySecret: consumerKeySecret,

        oauthToken: oauthToken,
        oauthTokenSecret: oauthTokenSecret,
        oauthVerifier: oauthVerifier,
        callback: myCallback
    };

    flickrApi.useRequestTokenToGetAccessToken(args);
}

module.exports = getApi;