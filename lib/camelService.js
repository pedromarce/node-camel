/*jslint node: true */
"use strict";

var xml2js = require('xml2js'),
    moment = require('moment'),
    conf = {},
    requests = {},
    tempQueue = guid(),
    client = null;

exports.init = function (config, clientParam) {
    conf = config;
    var client = clientParam,
        parseString = require('xml2js').parseString;

    client.subscribe({
        'destination': '/temp-queue/' + tempQueue,
        'ack': 'auto'
    }, function (error, message) {
        var req = null,
            res = null,
            next = null,
            status,
            request,
            bodyParsed;
        try {
            message.readString('utf8', function (error, string) {
                status = 0;
                request = null;
                bodyParsed = '';
                message.ack();
                if (message.headers.status) {
                    status = parseInt(message.headers.status, 10);
                }
                if (message.headers["correlation-id"]) {
                    request = message.headers["correlation-id"];
                    if (status === 202) {
                        if (requests[request] && requests[request].timeOut) {
                            clearTimeout(requests[request].timeOut);
                        }
                        return;
                    }
                    req = requests[request].req;
                    res = requests[request].res;
                    next = requests[request].next;
                    delete requests[request];
                }
                if (error) {
                    console.log("Error Parsing JSON : " + error);
                    if (req.callback) {
                        req.callback(error);
                    } else {
                        res.status(400, new Error('Error Parsing JSON : ' + error));
                        res.send(string);
                    }
                }
                if (status === 0 && bodyParsed.status) {
                    status = parseInt(bodyParsed.status, 10);
                    delete bodyParsed.status;
                }
                if (req.type === "JSON") {
                    bodyParsed = JSON.parse(string);
                    res.status(status);
                    res.send(bodyParsed);
                } else if (req.type === "XML") {
                    bodyParsed = string;
                    res.status(status);
                    res.send(bodyParsed);
                } else if (req.type === "XML2JS") {
                    parseString(string, function (err, result) {
                        res.status(status);
                        res.send(result);
                    });
                } else if (req.type === "SOAP") {
                    parseString(string, function (err, result) {
                        req.callback(result);
                    });
                }
            });
        } catch (e) {
            console.log("Error Parsing JSON : " + e.message);
            res.status(400, new Error('Error Parsing JSON : ' + e.message));
            res.send();
        }
        /*    if (req.header.type === "POST" || req.header.type === "DELETE")
              return next(); */
    });

    return exports;
};

/**** GENERAL FUNCTIONS *****/

/*** Generate unique identifiers ***/
function guid() {
    function p8(s) {
        var p = (Math.random().toString(16) + "000000000").substr(2, 8);
        return s ? "-" + p.substr(0, 4) + "-" + p.substr(4, 4) : p;
    }
    return p8() + p8(true) + p8(true) + p8();
}


exports.queueREST = function (client, secured) {
    return function (req, res, next) {

        if (secured && !conf.development && !req.username) {
            return res.sendUnauthenticated();
        }

        var uuid = guid(),
            jsonReq = {};
        if (req.username) {
            jsonReq.username = req.username;
        }
        jsonReq.params = req.params;
        jsonReq.query = req.query;
        jsonReq.route = req.route;
        requests[uuid] = {};
        requests[uuid].req = req;
        requests[uuid].req.type = "JSON";
        requests[uuid].res = res;
        requests[uuid].next = next;
        requests[uuid].timeOut = setTimeout(function () {
            res = requests[uuid].res;
            delete requests[uuid];
            res.status(408, new Error('Request timed out'));
            res.send("The client did not produce a request within the time that the server was prepared to wait. The client MAY repeat the request without modifications at any later time.");
        }, conf.timeout || 300000);

        client.send({
            'destination': conf.queueRest,
            'reply-to': '/temp-queue/' + tempQueue,
            'correlation-id': uuid,
            'expires': Date.now() + (conf.timeout || 300000)
        },
            JSON.stringify(jsonReq));
    };
};

exports.queueSOAP = function (client) {

    return function (msg, callback) {

        var builder = new xml2js.Builder({
            'rootName': 'Root' // Needs to be configured
        });

        delete msg.attributes;

        var uuid = guid();

        requests[uuid] = {};
        requests[uuid].req = {};
        requests[uuid].req.type = "XML2JS";
        requests[uuid].req.callback = callback;
        requests[uuid].timeOut = setTimeout(function () {
            var res = requests[uuid].res;
            delete requests[uuid];
            res.status(408, new Error('Request timed out'));
            res.send("The client did not produce a request within the time that the server was prepared to wait. The client MAY repeat the request without modifications at any later time.");
        }, conf.timeout || 300000);

        client.send({
                "destination": conf.queueOam,
                'reply-to': '/temp-queue/' + tempQueue,
                'correlation-id': uuid,
                'expires': Date.now() + (conf.timeout || 300000)
            },
            builder.buildObject(msg));
    };
};
