// TODO Base filename should match the name of default export
const log    = require('./config/logger');
const init   = require('./init');
const shdrcollection = require('./shdrcollection');
const xmltojson = require('./xmltojson');
const egress = require('./egress');
const Client = require('node-ssdp').Client // Control Point
const Loki   = require('lokijs');
const util   = require('util');
const net    = require('net');
const fs = require('fs');
const express = require('express');
const http = require('http');

// var xml = fs.readFileSync('./test/checkfiles/Devices2di.xml','utf8');
// var jsonobj = xmltojson.xmltojson(xml);
// var xmlschema = xmltojson.insertschematoDB(jsonobj);
var jsonobj;
var xmlschema;
var numberofds = 0;

const agent = new Client();
const db = new Loki('agent-loki.json');
const devices = db.addCollection('devices');

var inserteddata;
// TODO Global list of active sockets
agent.on('response', function inResponse(headers, code, rinfo) {
  // TODO Handle CACHE-CONTROL

  var headerData = JSON.stringify(headers, null, '  ');
  var data = JSON.parse(headerData);
  var location = data['LOCATION'].split(':');
  var found = devices.find( {'address': location[0], 'port': location[1]} );

  // TODO Maybe remove old entries and insert the latest
  if (found.length < 1) {
    devices.insert({ address: location[0], port: location[1] });
  }
  var options ={
    hostname: 'localhost',
    port: 8080,
    path: '/sampledevice.xml',

  }

  //GET ip:8080/VMC-3Axis.xml
  http.get(options, (res) => {
   console.log(`Got response: ${res.statusCode}`);
   res.resume();
   res.setEncoding('utf8');
   res.on('data', (chunk) => {
     jsonobj = xmltojson.xmltojson(chunk);
     //if (numberofds == 0){
       xmlschema = xmltojson.insertschematoDB(jsonobj);
     //}else{

     //}
    //console.log(util.inspect(xmlschema, false, null))
    });
  }).on('error', (e) => {
   console.log(`Got error: ${e.message}`);
  });
});
// Search for interested devices
setInterval(() => {
  agent.search('urn:schemas-upnp-org:service:VMC-3Axis:1');
}, 10000);

// TODO For each device in lokijs, create a socket and connect to it.
// Search for interested devices
setInterval(() => {
  const activeDevices = devices.find({});

  log.debug('activeDevices:');
  log.debug(util.inspect(activeDevices));

  activeDevices.forEach((d) => {
    const client = new net.Socket();

        client.connect(d.port, d.address, () => {
            console.log('Connected.');
        });

        client.on('data', function(data) {
            console.log('Received: ' + data);
            var shdr = shdrcollection.shdrParsing(String(data));
            inserteddata = shdrcollection.dataCollectionUpdate(shdr);
         });

        client.on('close', () => {
	      console.log('Connection closed');
        });
    });
}, 30000);

setTimeout( () => {
  var app = express();
  var xml = fs.readFileSync('./test/checkfiles/Devices2di.xml','utf8');
  var jsonobj = xmltojson.xmltojson(xml);
  var xmlschema = xmltojson.insertschematoDB(jsonobj);

  app.get('/current', function(req, res) {
    var name = xmlschema.data[0].device.$.name;
    var jsondata = egress.searchdeviceschema(name, xmlschema,shdrcollection.shdr);
    var json2xml = egress.jsontoxml(JSON.stringify(jsondata), './test/checkfiles/result.xml');
    var currentxml = fs.readFileSync(json2xml, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/plain',
                              'Trailer': 'Content-MD5' });
    res.write(currentxml);
    res.addTrailers({'Content-MD5': '7895bf4b8828b55ceaf47747b4bca667'});
    res.end();
  });

  app.listen(7000, () => {
    console.log('app listening in port 7000');
  });
},50000);

module.exports = {
  inserteddata,
};
