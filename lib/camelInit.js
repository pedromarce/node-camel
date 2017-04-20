/*jslint node: true */
"use strict";

var jmsClient = require('./camelJMS'),
    rest = require('./camelRest'),
    ws = require('./camelWS'),
    soap = require('./camelSoap'),
    util = require('./camelService'),
    es = require('./camelES'),
    lodash = require('lodash'),
    cluster = require('cluster');

function dynamicRoutes(conf, RestServer, swaggerObject, client) {

    var respond = util.queueREST(client, true),
        unsecuredRespond = util.queueREST(client, false),
        pathObject = {};

    lodash.forEach(Object.keys(swaggerObject.paths), function (path) {
        pathObject = swaggerObject.paths[path];
        lodash.forEach(Object.keys(swaggerObject.paths[path]), function (verb) {
            path = path.replace('{uniqueId}', ':id');

            //console.log("Add resource %s", path + " " + verb + " ");
            switch (verb) {
            case "get":
                if (pathObject['x-unsecured-get']) {
                    RestServer.server.get(path, unsecuredRespond);
                } else {
                    RestServer.server.get(path, respond);
                }
                if (conf.development) {
                    RestServer.server.get("/test" + path, respond);
                }
                break;
            case "post":
                if (pathObject['x-unsecured-post']) {
                    RestServer.server.post(path, unsecuredRespond);
                } else {
                    RestServer.server.post(path, respond);
                }
                if (conf.development) {
                    RestServer.server.post("/test" + path, respond);
                }
                break;
            case "put":
                if (pathObject['x-unsecured-put']) {
                    RestServer.server.put(path, unsecuredRespond);
                } else {
                    RestServer.server.put(path, respond);
                }
                if (conf.development) {
                    RestServer.server.put("/test" + path, respond);
                }
                break;
            case "delete":
                if (pathObject['x-unsecured-delete']) {
                    RestServer.server.del(path, unsecuredRespond);
                } else {
                    RestServer.server.del(path, respond);
                }
                if (conf.development) {
                    RestServer.server.del("/test" + path, respond);
                }
                break;
            }
        });
    });
}

exports.init = function (conf) {
    var swaggerObject = require(conf.swaggerFile),
        swagger,
        client,
        RestServer;


    // Connect to jms queye
    console.log(JSON.stringify(conf));
    client = jmsClient.JmsClient(conf.jmsHost, conf.jmsPort, conf.jmsUser, conf.jmsPassword);

    util.init(conf, client);
    rest.init(conf);

    if (conf.swaggerStart) {
        swagger = require('./camelSwagger');
        swagger.init(conf);
    }

    if (cluster.isWorker) {
        console.log('Worker ' + process.pid + ' has started.');
        // Send message to master process.
        process.send({
            msgFromWorker: 'This is from worker ' + process.pid + '.'
        });
        // Receive messages from the master process.
        process.on('message', function (msg) {
            console.log('Worker ' + process.pid + ' received message from master.', msg);
        });
    }

    if (conf.soapStart) {

        console.log("Starting SOAP");

        soap.SoapServer(conf.soapPort, util.queueSOAP(client));

    }

    if (conf.wsStart) {
        console.log("Starting WS");

        ws.WsServer(conf.wsPort, client, conf.queueBREHtml);
    }

    if (conf.restStart) {

        console.log("Starting REST");

        /** Start REST server ***/
        RestServer = rest.RestServer(conf, conf.restPort, util.queueREST(client));

        dynamicRoutes(conf, RestServer, swaggerObject, client);

        RestServer.server.get('/version', util.queueREST(client));

    }

    if (conf.esLoaderStart) {

        console.log("Starting ES Loader");

        es.EsLoader(conf, client);

    }

};
