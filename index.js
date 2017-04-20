/*jslint node: true */
"use strict";

var myArgs = process.argv.slice(2);
var confFile = './Configuration.json';
if (myArgs[0]) {
    confFile = myArgs[0];
}

var conf = require(confFile);
var server = require('./lib/camelInit');

process.setMaxListeners(3);
server.init(conf);
