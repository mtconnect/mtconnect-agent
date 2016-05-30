const fs = require ('fs');
const xml2js = require('xml2js');
const util = require ('util');
const loki = require('./lokijs');

var mtcdevices = loki.getschemaDB();
//xml device schema to json conversion
function xmltojson(xmlobj){

  var jsonobj;
  var parser  = new xml2js.Parser({attrkey: '$'});

  // xml to json
  var data = parser.parseString( xmlobj,function parsecallback(err, result) {
              jsonobj = result;
  });

  return jsonobj;
}


function insertschematoDB(parseddata){
  // read objects from json and insert into collection
  var xmlns = parseddata.MTConnectDevices.$; // namespace
  var timeval = parseddata.MTConnectDevices.Header[0].$.creationTime; // time from Header

  var numberofdevices = parseddata.MTConnectDevices.Devices.length;
  var numberofdevice =  parseddata.MTConnectDevices.Devices[0].Device.length;
  var uuid =[] //new Array(numberofdevices * numberofdevice);
  var device = []//new Array(numberofdevices * numberofdevice);

  for (var j =0; j < numberofdevices; j++){
    for (var i = 0; i < numberofdevice; i++){
      uuid[i] =  parseddata.MTConnectDevices.Devices[0].Device[i].$.uuid;
      device[i] = parseddata.MTConnectDevices.Devices[0].Device[i];
      mtcdevices.insert({xmlns: xmlns, time: timeval, uuid: uuid[i], device: device[i]});
    }
  }
  return mtcdevices;
}

// read xml file
// var xml = fs.readFileSync('../test/checkfiles/Devices2di.xml','utf8');
// var jsonobj = xmltojson(xml);

//console.log(util.inspect(jsonobj.MTConnectDevices.Devices[0].Device[0].DataItems[0].DataItem[1].$.type, false, null));
//var jsonobj = fs.readFileSync('E:/Devices2di.json','utf8');
//var insertedschema = insertschematoDB(jsonobj);
//console.log(util.inspect(insertedschema, false, null));

module.exports = {
  xmltojson,
  insertschematoDB,
};
