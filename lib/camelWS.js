/*jslint node: true */
"use strict";

var http = require('http'),
    sockjs = require('sockjs');

/******** WS SERVER   ****************/

function WsServer(port, jmsClient, queue) {
    /** Start WS server ***/

    var ws = sockjs.createServer();
    ws.on('connection', function (conn) {
        var connId = '';
        conn.on('data', function (message) {
            connId = message;
        });
        conn.on('close', function () {
            jmsClient.send({
                    "destination": queue
                },
                JSON.stringify({
                    Disconnect: connId
                }));
            console.log(connId + 'disconnected');
        });
    });


    this.server = http.createServer();

    ws.installHandlers(this.server, {
        prefix: '/ws'
    });

    this.server.listen(port, '0.0.0.0');
}

/****** REST SERVER *********/

exports.WsServer = function (port, jmsClient, queue) {
    return new WsServer(port, jmsClient, queue);
};
