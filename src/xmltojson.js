/**
  * fns: xmltojson, insertschematoDB
  */
const fs = require ('fs');
const xml2js = require('xml2js');
const util = require ('util');
const loki = require('./lokijs');
var mtcdevices = loki.getschemaDB();


/**
  *xml device schema to json conversion
  */
function xmltojson(xmlobj) {
  var jsonobj;
  var parser  = new xml2js.Parser({attrkey: '$'});

  // xml to json
  var data = parser.parseString(xmlobj, function parsecallback(err, result) {
              jsonobj = result;
  });
  return jsonobj;
}


/**
  * read objects from json and insert into collection
  */
function insertschematoDB(parseddata) {
  // namespace
  var xmlns = parseddata.MTConnectDevices.$;

  // time from Header
  var timeval = parseddata.MTConnectDevices.Header[0].$.creationTime;
  var numberofdevices = parseddata.MTConnectDevices.Devices.length;
  var numberofdevice =  parseddata.MTConnectDevices.Devices[0].Device.length;
  var uuid = [];
  var device = [];
  var name = [];
  var Devices0 = parseddata.MTConnectDevices.Devices[0] ;

  for (var j =0; j < numberofdevices; j++) {
    for (var i = 0; i < numberofdevice; i++) {
      name[i] = Devices0.Device[i].$.name;
      uuid[i] =  Devices0.Device[i].$.uuid;
      device[i] = Devices0.Device[i];
      mtcdevices.insert( {xmlns: xmlns, time: timeval, name: name[i], uuid: uuid[i], device: device[i]} );
    }
  }
  return mtcdevices;
}

module.exports = {
  xmltojson,
  insertschematoDB,
};
