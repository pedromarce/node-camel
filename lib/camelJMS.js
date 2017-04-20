/*jslint node: true */
"use strict";

var stompit = require('stompit');

function JmsClient(host, port, user, password) {

    var servers, reconnectOptions, connections, address;
    servers = [{
        'host': host,
        'port': port,
        'connectHeaders': {
            'login': user,
            'passcode': password,
            'host': host,
            'heart-beat': '15000,15000'
        }
    }];
    reconnectOptions = {
        maxReconnectAttempts: 10,
        maxAttempts: 10
    };
    connections = new stompit.ConnectFailover(servers, reconnectOptions);

    connections.on('connecting', function (connector) {

        address = connector.serverProperties.remoteAddress.transportPath;

        console.log('Connecting to ' + address);
    });

    connections.on('error', function (error) {

        address = error.connectArgs.host + ':' + error.connectArgs.port;

        console.log('Connection error to ' + address + ': ' + error.message);
    });

    this.channel = new stompit.Channel(connections, {
        'alwaysConnected': true
    });

}

JmsClient.prototype.subscribe = function (headers, callback) {
    return this.channel.subscribe(headers, callback);
};

JmsClient.prototype.send = function (headers, body, callback) {
    return this.channel.send(headers, body, callback);
};

exports.JmsClient = function (host, port, user, password) {
    return new JmsClient(host, port, user, password);
};
