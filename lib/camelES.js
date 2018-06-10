/*jslint node: true */
"use strict";

var elasticsearch = require('elasticsearch');

function EsLoader(conf, jmsClient) {

    var ESClient = new elasticsearch.Client({
            host: conf.esURL
        }),
        bulk = {
            body: []
        },
        batch = conf.esBulk || 0,
        records = 0,
        runBulk = null;

    console.log("Batch : " + batch);

    jmsClient.subscribe({
        'destination': conf.queueLoader,
        'ack': 'client-individual'
    }, function (error, message) {

        if (error) {
            console.log('subscribe error ' + error.message);
            return;
        }

        message.readString('utf-8', function (error, body) {

            var json = JSON.parse(body),
                action = json.action;

            if (batch > 0 && (action === 'create' || action === 'index' || action === 'update' || action === 'delete')) {
                if (!runBulk) {
                    runBulk = setTimeout(executeBulk, conf.esTimer, ESClient, true);
                }

                records += 1;
            }

            if (!(action === 'create' || action === 'index' || action === 'update' || action === 'delete' || action === 'updateByQuery')) {
                console.log('Invalid action specified: ' + action + ' - could not load ');
                message.ack();
                return;
            }
            delete json.action;
            switch (action) {
            case "create":

                createJSON(ESClient, json, message);
                break;

            case "index":
            case "update":

                indexJSON(ESClient, json, message);
                break;

            case "delete":

                deleteJSON(ESClient, json, message);
                break;

            case "updateByQuery":

                updateByQueryJSON(ESClient, json, message);
                break;
            }

            if (error) {
                console.log('read message error ' + error.message);
                return;
            }
        });
    });

    var executeBulk = function (ESClient, timed) {
        var recordsToLoad = records;
        if (records >= batch || timed) {
            var bulkLoad = JSON.parse(JSON.stringify(bulk));
            bulk = {
                body: []
            };
            if (runBulk) {
                clearTimeout(runBulk);
                runBulk = null;
            }
            console.log("Sent Records:" + records);
            records = 0;
            ESClient.bulk(bulkLoad, function (error, response) {
                if (error) {
                    console.log(error);
                } else {
                    if (response.errors) {
                        console.log(JSON.stringify(response));
                    } else {
                        console.log("Indexed records : " + response.items.length + " from " + recordsToLoad);
                    }
                }
            });
        }
    };

    var createJSON = function (ESClient, json, message) {

        if (batch > 0) {
            var bulkOp = {
                "create": {
                    "_index": (conf.environment || '') + json.index,
                    "_type": json.type,
                    "_id": json.id
                }
            };
            if (json.parent) {
                bulkOp.create._parent = json.parent;
            }
            bulk.body.push(bulkOp);
            bulk.body.push(json.body);
            executeBulk(ESClient, false);
            message.ack();
        } else {
            console.log("create");
            ESClient.index(json, function (error) {

                if (error) {
                    message.nack();
                    console.log(error);
                    return;
                }
                message.ack();

            });
        }
    };

    var indexJSON = function (ESClient, json, message) {

        if (batch > 0) {
            var bulkOp = {
                "index": {
                    "_index": (conf.environment || '') + json.index,
                    "_type": json.type,
                    "_id": json.id
                }
            };
            if (json.parent) {
                bulkOp.index._parent = json.parent;
            }
            bulk.body.push(bulkOp);
            bulk.body.push(json.body);
            executeBulk(ESClient, false);
            message.ack();
        } else {
            console.log("index");
            ESClient.index(json, function (error) {

                if (error) {
                    message.nack();
                    console.log(error);
                    return;
                }
                message.ack();


            });
        }

    };

    var deleteJSON = function (ESClient, json, message) {

        if (batch > 0) {
            bulk.body.push({
                "delete": {
                    "_index": (conf.environment || '') + json.index,
                    "_type": json.type,
                    "_id": json.id
                }
            });
            executeBulk(ESClient, false);
            message.ack();
        } else {
            console.log("delete");
            ESClient.delete(json, function (error) {

                if (error) {
                    message.nack();
                    console.log(error);
                    return;
                }
                message.ack();

            });
        }

    };

    var updateByQueryJSON = function (ESClient, json, message) {

        /*
        example value :
         json = {
                  index: indexname,
                  type: typename,
                  body: {
                    "query": { "match": { "animal": "bear" } },
                    "script": { "inline": "ctx._source.color = 'brown'"}
                  }
                }
        */


        console.log("updateByQuery");
        ESClient.updateByQuery(json, function (error) {
            if (error) {
                message.nack();
                console.log(error);
                return;
            }
            message.ack();


        });

    };

}

exports.EsLoader = function (conf, jmsClient) {
    return new EsLoader(conf, jmsClient);
};
