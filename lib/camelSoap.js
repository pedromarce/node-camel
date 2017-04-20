/*jslint node: true */
"use strict";

var http = require('http');
var fs = require('fs');
var soap = require('soap');
var path = require('path');

function SoapServer(port, respond) {

  console.log("Starting SOAP server");

  this.service = {
    SMWebServiceWSService: {
      SMWebServiceWSPort: {
        SMWebServiceWS: function(args, callback) {
          respond(args, callback);
        }
      }
    }
  };


  this.xml = require('fs').readFileSync(path.join(__dirname, 'HiAffinity.wsdl'), 'utf8');
  this.server = http.createServer(function(request, response) {
      response.end("404: Not Found: " + request.url);
    });

  this.server.listen(port);
  soap.listen(this.server, '/SMWebServiceWS', this.service, this.xml);
  console.log("Server SOAP listening");

}

/******** SOAP SERVER ************/

exports.SoapServer = function(port, respond) {
  return new SoapServer(port, respond);
};
