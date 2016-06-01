const log    = require('./config/logger');
const init   = require('./init');
const shdrcollection = require('./shdrcollection');
const xmltojson = require('./xmltojson');
const egress = require('./egress');
const Client = require('node-ssdp').Client // Control Point
const loki   = require('lokijs');
const util   = require('util');
const net    = require('net');
const fs = require('fs');
const express = require('express');

var xml = fs.readFileSync('E:/svc-agent-reader/test/checkfiles/Devices2di.xml','utf8');
var jsonobj = xmltojson.xmltojson(xml);
var xmlschema = xmltojson.insertschematoDB(jsonobj);

var agent = new Client();

var db = new loki('agent-loki.json');
var devices = db.addCollection('devices');

var inserteddata;
// TODO Global list of active sockets

agent.on('response', function inResponse(headers, code, rinfo) {
    // TODO Handle CACHE-CONTROL

    var headerData = JSON.stringify(headers, null, '  ');
    var data = JSON.parse(headerData);
    var location = data['LOCATION'].split(':');

    var found = devices.find( {'address': location[0], 'port': location[1]} );

    var insert = (found == false) ? devices.insert( { 'address' : location[0], 'port' : location[1] } ) : false ;
});

// Search for interested devices
setInterval( () => {
    agent.search('urn:schemas-upnp-org:service:VMC-3Axis:1');
}, 10000);

// TODO For each device in lokijs, create a socket and connect to it.
// Search for interested devices
setInterval( () => {
    var activeDevices = devices.find({});

    log.debug(util.inspect(activeDevices));

    for (var obj of activeDevices) {
        var client = new net.Socket();

        client.connect(obj.port, obj.address, () => {
            console.log('Connected.');
        });

        client.on('data', function(data) {
            console.log('Received: ' + data);
            //console.log(typeof(data))
            var shdr = shdrcollection.shdrparsing(data.toString());
            inserteddata = shdrcollection.datacollectionupdate(shdr);
         });

        client.on('close', () => {
	      console.log('Connection closed');
        });
    }
}, 30000);

setInterval( () => {
  var app = express();

  var xml = fs.readFileSync('E:/svc-agent-reader/test/checkfiles/Devices2di.xml','utf8');
  var jsonobj = xmltojson.xmltojson(xml);
  var xmlschema = xmltojson.insertschematoDB(jsonobj);
  //console.log(util.inspect(xmlschema,false, null))

  app.get('/current', function(req, res) {
    //res.send('Hello my World chill!! ');
    var name = xmlschema.data[0].device.$.name;
    var jsondata = egress.searchdeviceschema(name, xmlschema,shdrcollection.shdr);
    var json2xml = egress.jsontoxml(JSON.stringify(jsondata), '../svc-agent-reader/test/checkfiles/result.xml');
    var currentxml = fs.readFileSync(json2xml, 'utf8');
    //res.send(currentxml);
    //console.log(util.inspect(currentxml, false, null));
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
