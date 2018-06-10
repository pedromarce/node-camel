/*jslint node: true */
"use strict";

var elasticsearch = require('elasticsearch');


var ESClient = new elasticsearch.Client({
        host: 'http://localhost:9200'
    }),
    bulk = {
        body: []
    },
    batch = 1000,
    records = 0,
    runBulk = null,
    i = 0,
    json,
    action = 'index';


function executeBulk(ESClient, timed) {
    var recordsToLoad = records,
        bulkLoad = JSON.parse(JSON.stringify(bulk));
    if (records >= batch || timed) {
        bulk = {
            body: []
        };
        if (runBulk) {
            clearTimeout(runBulk);
            runBulk = null;
        }
        console.log("Sent Records:" + records);
        //console.log(JSON.stringify(bulkLoad));
        records = 0;
        ESClient.bulk(bulkLoad, function (error, response) {
            console.log("SAVED");
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
}

function indexJSON(ESClient, json) {

    if (batch > 0) {
        var bulkOp = {
            "index": {
                "_index": json.index,
                "_type": json.type,
                "_id": json.id
            }
        };
        bulk.body.push(bulkOp);
        bulk.body.push(json.body);
        executeBulk(ESClient, false);

    } else {
        console.log("index");
        ESClient.index(json, function (error) {

            if (error) {
                console.log(error);
                return;
            }
        });
    }

}

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + 1);
}

var numLF,
    numSC,
    i,
    j,
    k,
    bp;

for (i = 1; i < 99; i++) {
    bp = random(1, 1000);
    json = {
      'id': 'BP' + bp + 'PM' + i,
      'index': 'websearch',
        'type': 'promoter',
        'body': {
            'promoterName': 'Promoter ' + i,
            'bp': bp
        }
    };
    console.log("PM " + i);
    records += 1;

    indexJSON(ESClient, json);

    numLF = random(101, 230);
    for (j = 101; j <= numLF; j++) {
        json = {
          'id': 'BP' + bp + 'PM' + i + 'LF' + j,
          'index': 'websearch',
            'type': 'legal-fund',
            'body': {
                'legalFundName': 'Legal Fund ' + j,
                'bp': bp,
                'promoter': 'BP' + bp + 'PM' + i,
                'promoterName': 'Promoter ' + i
            }
        };
        records += 1;
        indexJSON(ESClient, json);

        numSC = random(1, 40);
        for (k = 1; k <= numSC; k++) {
            json = {
                'id': 'BP' + bp + 'PM' + i + 'LF' + j + 'SC' + (k + 1000) ,
                'index': 'websearch',
                'type': 'share-class',
                'body': {
                    'shareClassName': 'Share Class ' + (k + 1000),
                    'legalFund': 'BP' + bp + 'PM' + i + 'LF' + j,
                    'legalFundName': 'Legal Fund ' + j,
                    'bp': bp,
                    'promoter': 'BP' + bp + 'PM' + i,
                    'promoterName': 'Promoter ' + i
                }
            };
            records += 1;
            indexJSON(ESClient, json);
        }

    }
}
executeBulk(ESClient, true);
