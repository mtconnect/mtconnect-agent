var fs = require ('fs');
var xml2js = require('xml2js');
var util = require ('util');
const shdrcollection = require("./lokijs");

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

  var deviceslength = parseddata.MTConnectDevices.Devices.length;
  var devicelength =  parseddata.MTConnectDevices.Devices[0].Device.length;
  var uuid = new Array(deviceslength * devicelength);
  var device = new Array(deviceslength * devicelength);

  for (var j =0; j < deviceslength; j++){
    for (var i = 0; i < devicelength; i++){
      uuid[i] =  parseddata.MTConnectDevices.Devices[0].Device[i].$.uuid;
      device[i] = parseddata.MTConnectDevices.Devices[0].Device[i];
      mtcdevices.insert({xmlns: xmlns, time: timeval, uuid: uuid[i], device: device[i]})
    }
  }
  return mtcdevices;
}

// read xml file
var xml = fs.readFileSync('E:/specimpl/database/VMC-3Axis.xml','utf8');
var mtcdevices = shdrcollection.getschemaDB();
var jsonobj = xmltojson(xml);
//console.log(util.inspect(jsonobj, false, null));

var insertedschema = insertschematoDB(jsonobj);
//console.log(util.inspect(insertedschema, false, null));
