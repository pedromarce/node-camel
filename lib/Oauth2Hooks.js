/*jslint node: true */
"use strict";

var _ = require("underscore"),
    Db = require("tingodb")().Db,
    crypto = require("crypto"),
    path = require('path'),
    jmsClient = require("./camelJMS");

var database, client, collection, secret, conf;

exports.init = function (config) {
    conf = config;
    database = new Db(path.join(__dirname, '/../db'), {});
    client = jmsClient.JmsClient(conf.jmsHost, conf.jmsPort, conf.jmsUser, conf.jmsPassword);

    collection = database.collection("oauth2_token");

    secret = {
        clients: {
            officialApiClient: {
                secret: "C0FFEE"
            },
            unofficialClient: {
                secret: "DECAF"
            }
        }
    };

};

/*** Generate unique identifiers ***/
function guid() {
    function _p8(s) {
        var p = (Math.random().toString(16) + "000000000").substr(2, 8);
        return s ? "-" + p.substr(0, 4) + "-" + p.substr(4, 4) : p;
    }
    return _p8() + _p8(true) + _p8(true) + _p8();
}

function generateToken(data) {
    var random = Math.floor(Math.random() * 100001);
    var timestamp = (new Date()).getTime();
    var sha256 = crypto.createHmac("sha256", random + "WOO" + timestamp);

    return sha256.update(data).digest("base64");
}

exports.validateClient = function (credentials, req, cb) {
    // Call back with `true` to signal that the client is valid, and `false` otherwise.
    // Call back with an error if you encounter an internal server error situation while trying to validate.
    var isValid = _.has(secret.clients, credentials.clientId) &&
        secret.clients[credentials.clientId].secret === credentials.clientSecret;
    cb(null, isValid);
};

exports.grantUserToken = function (credentials, req, cb) {
    var uuid = guid();
    /*** Subscribre to a unique queue (ideally should use temporary queue but it wasn't working)
            to process reply from jms queue **/
    client.subscribe({
        'destination': '/temp-queue/' + uuid,
        'ack': 'auto'
    }, function (error, message, subscription) {
        try {
            console.log(new Date().toISOString() + " Response received for %s", uuid);
            /*            console.log(new Date().toISOString() + " Header : %s", headers);
                        console.log(new Date().toISOString() + " Body : %s", body); */
            message.readString('utf8', function (error, string) {
                var status = 0;
                message.ack();
                if (message.headers.status) {
                    status = parseInt(message.headers.status);
                    if (status === 202) {
                        return;
                    }
                }
                subscription.unsubscribe();
                var bodyParsed = JSON.parse(string);
                if (error) {
                    console.log("Error Parsing JSON : " + error);
                    return cb(error, null);
                }
                if (bodyParsed.login && bodyParsed.login === "login") {
                    // If the user authenticates, generate a token for them and store it so `exports.authenticateToken` below
                    // can look it up later.
                    var token = generateToken(credentials.username + ":" + credentials.password);
                    // database.tokensToUsernames[token] = credentials.username;
                    return collection.remove({
                        "username": credentials.username
                    }, {
                        w: 1
                    }, function (err, numberDeleted) {
                        collection.insert({
                            "token": token,
                            "username": credentials.username
                        }, {
                            w: 1
                        }, function (err, result) {
                            if (err) {
                              return cb(err, null);
                            }
                            return cb(null, token);
                        });
                    });

                    // Call back with the token so Restify-OAuth2 can pass it on to the client.
                }
                // Call back with `false` to signal the username/password combination did not authenticate.
                // Calling back with an error would be reserved for internal server error situations.
                cb(null, false);

            });
        } catch (e) {
            cb(null, false);
        }
    });

    console.log("Request sent for %s", uuid);
    client.send({
            "destination": conf.queueRest,
            'reply-to': '/temp-queue/' + uuid
        },
        JSON.stringify({
            "query": {},
            "route": {
                "method": "POST",
                "path": "/login"
            },
            "params": credentials
        }));
};

exports.authenticateToken = function (token, req, cb) {
    return collection.findOne({
        "token": token
    }, function (err, item) {
        if (item) {
            // If the token authenticates, set the corresponding property on the request, and call back with `true`.
            // The routes can now use these properties to check if the request is authorized and authenticated.
            req.username = item.username;
            return cb(null, true);
        }
        // If the token does not authenticate, call back with `false` to signal that.
        // Calling back with an error would be reserved for internal server error situations.
        if (!conf.development) {
            return cb(null, false);
        }
        return cb(null, true);

    });
};
