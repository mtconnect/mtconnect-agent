const egress = require('./egress');
const xmltojson = require('./xmltojson');
const util   = require('util');
const express = require('express');
const fs = require('fs');
const main = require('./main');
const shdrcollection = require('./shdrcollection')
var app = express();


var xml = fs.readFileSync('E:/svc-agent-reader/test/checkfiles/Devices2di.xml','utf8');
var jsonobj = xmltojson.xmltojson(xml);
var xmlschema = xmltojson.insertschematoDB(jsonobj);
//console.log(util.inspect(xmlschema,false, null))

app.get('/current', function(req, res) {
  //res.send('Hello my World chill!! ');
  var name = xmlschema.data[0].device.$.name;
  var jsondata = egress.searchdeviceschema(name, xmlschema,shdrcollection.shdr);
  var json2xml = egress.jsontoxml(JSON.stringify(jsondata), '../test/checkfiles/result.xml');
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
