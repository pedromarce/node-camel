/*jslint node: true */
"use strict";

var restify = require('restify'),
    util = require('./camelService'),
    hooks,
    oauth2;

exports.init = function (conf) {
    console.log("Development mode : " + conf.development);
    hooks = require(conf.oauth2hooks);
    hooks.init(conf);
    oauth2 = require('restify-oauth2');
};

function RestServer(conf, port, respond) {
    /** Start REST server ***/
    this.server = restify.createServer({
        name: 'Rest'
    });

    this.server.use(restify.authorizationParser());

    // Adjust restify to parse query string and body parameters in req.params (easy to deal with)
    this.server.use(restify.queryParser({
        mapParams: false
    }));
    this.server.use(restify.bodyParser());

    restify.CORS.ALLOW_HEADERS.push('authorization');
    restify.CORS.ALLOW_HEADERS.push('If-Modified-Since');
    restify.CORS.ALLOW_HEADERS.push('Cache-Control');
    restify.CORS.ALLOW_HEADERS.push('Pragma');

    // Enable CORS header values (allow ajax calls for different hosts)
    this.server.use(restify.CORS({
        origins: ['*']
    }));
    this.server.use(restify.fullResponse());


    this.server.on("MethodNotAllowed", function (request, response) {
        if (request.method.toUpperCase() === "OPTIONS") {
            // Send the CORS headers
            //
            response.header("Access-Control-Allow-Credentials", true);
            response.header("Access-Control-Allow-Headers", restify.CORS.ALLOW_HEADERS.join(", "));
            response.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            response.header("Access-Control-Allow-Origin", request.headers.origin);
            response.header("Access-Control-Max-Age", 0);
            response.header("Content-type", "text/plain charset=UTF-8");
            response.header("Content-length", 0);

            response.send(204);
        } else {
            response.send(new restify.MethodNotAllowedError());
        }
    });

    oauth2.ropc(this.server, {
        tokenEndpoint: '/token',
        hooks: hooks
    });
    this.server.listen(port, function () {
    });
    this.respond = respond;
}

/****** REST SERVER *********/

exports.RestServer = function (conf, port, respond) {
    return new RestServer(conf, port, respond);
};
