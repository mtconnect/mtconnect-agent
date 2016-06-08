/**
  *fns: readFromDataCollection, searchDeviceSchema, jsontoxml
  */
const lokijs = require('./lokijs');
const shdrcollection = require('./shdrcollection');
const R = require('ramda');
const util = require ('util');
const loki = require('lokijs');
const stream = require('stream');
const fs = require ('fs');
const converter = require('converter');


function readFromDataCollection(dbobj, id_val, uuid_val, name_val) {
  var shdrobj = dbobj.toObject();
  var bufferObjects = R.values(shdrobj);
  var sameuuid = R.filter( (v) => v.uuid === uuid_val )(bufferObjects);
  var sameid = R.filter( (v) => v.id === id_val )(sameuuid);
  var samename = R.filter( (v) => v.dataitemname === name_val )(sameid);
  result = samename[samename.length-1];
  return result;
}

function searchDeviceSchema(uuid, datacollectionptr) {
  var resultdeviceschema = lokijs.getschemaDB();
  var searchresult = resultdeviceschema.chain()
                                       .find({ 'uuid': uuid })
                                       .sort('time')
                                       .data();
  var DataItemvar= [];
  var filterresult = [];
  var newxmlns = searchresult[0].xmlns;
  var newtime = searchresult[0].time;
  var newuuid = searchresult[0].uuid;
  var searchdevice0 = searchresult[0].device.DataItems[0];
  var numberofdataitems = searchdevice0.DataItem.length;
  var val;
  for (var i =0; i < numberofdataitems; i++) {
    filterresult[i] = readFromDataCollection(datacollectionptr, searchdevice0.DataItem[i].$.id,
                                searchresult[0].device.$.uuid, searchdevice0.DataItem[i].$.name );
    val = filterresult[i].value.split('\r');
    DataItemvar[i] = { "$": { "type":searchdevice0.DataItem[i].$.type,
                            "category":searchdevice0.DataItem[i].$.category,
                            "id":searchdevice0.DataItem[i].$.id,
                            "name":searchdevice0.DataItem[i].$.name}, "_":val[0] }
  }

  var newjson = { "MTConnectDevices": { "$":newxmlns,
  "Header":[{ "$":
  { "creationTime":newtime, "assetBufferSize":"1024", "sender":"localhost", "assetCount":"0",
  "version":"1.3", "instanceId":"0", "bufferSize":"524288" } }],
  "Devices":[ { "Device":[ { "$":
  { "name":searchresult[0].device.$.name, "uuid":searchresult[0].device.$.uuid,
    "id":searchresult[0].device.$.id },
    "Description":searchresult[0].device.Description,
    "DataItems":[{ "DataItem":DataItemvar }]
  } ]} ]} }

  return newjson;
}

function jsontoxml(source, destination) {
  //reading a string and creating a stream, not required when passing a file
  var s = new stream.Readable();
  s._read = function noop() {
    this.push(source);
    this.push(null);
  };

 //Use 'fs.createReadStream(source)' to pass a file in place of s
  var jsonreader = s;
  var xmlwriter = fs.createWriteStream(destination);
  var options = {
    	from: 'json',
    	to: 'xml',
    };
  var convert = converter(options);
  jsonreader.pipe(convert).pipe(xmlwriter);
  return destination;
}

module.exports = {
  readFromDataCollection,
  searchDeviceSchema,
  jsontoxml,
};
