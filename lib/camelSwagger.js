/*jslint node: true */
"use strict";

var bodyParser = require('body-parser');
var parseurl = require('parseurl');
var qs = require('qs');
var swagger = require('swagger-tools');
var swaggerUi = require('./swagger/swagger-ui.js'); // Needs to be in config
var connect = require('connect');
var http = require('http');
var app = connect();


exports.init = function (conf) {
    var swaggerObject = require(conf.swaggerFile); // This assumes you're in the root of the swagger-tools
    // Wire up the middleware required by Swagger Tools (body-parser and qs)
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: false
    }));
    app.use(function (req, res, next) {
        if (!req.query) {
            req.query = req.url.indexOf('?') > -1 ? qs.parse(parseurl(req).query, {}) : {};
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Request-Method', '*');
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
        res.setHeader('Access-Control-Allow-Headers', '*');
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        return next();
    });

    // Serve the Swagger documents and Swagger UI
    //   http://localhost:3000/docs => Swagger UI
    //   http://localhost:3000/api-docs => Swagger document
    app.use(swaggerUi(swaggerObject));
    // Start the server
    http.createServer(app).listen(conf.swaggerPort);
    console.log("server created");
    return exports;
};
