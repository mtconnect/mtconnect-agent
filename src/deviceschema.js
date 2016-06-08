/**
  *
  */
const lokijs = require('./lokijs');
const xmltojson = require('./xmltojson');
const util = require ('util');
const R = require('ramda');

function compareSchema(foundfromdc, newobj){
  var dcheader = foundfromdc[0].xmlns;
  var dctime = foundfromdc[0].time;
  var dcdevice = foundfromdc[0].device;
  var newheader = newobj.MTConnectDevices.$;
  var newtime = newobj.MTConnectDevices.Header[0].$.creationTime;
  var newdevice = newobj.MTConnectDevices.Devices[0].Device[0];

  if (R.equals(dcheader, newheader)){
    if(R.equals(dctime, newtime)){
      if(R.equals(dcdevice, newdevice)){
            return true;
      } else return false;
    } else return false;
  } else return false;
}

function updateSchemaCollection(schemareceived){
  var jsonobj = xmltojson.xmltojson(schemareceived);
  var uuid = jsonobj.MTConnectDevices.Devices[0].Device[0].$.uuid;
  var schemaptr = lokijs.getschemaDB();
  var xmlschema;
  var check_uuid = schemaptr.chain()
                            .find({'uuid': uuid})
                            .data();
  if (!check_uuid.length){
    console.log("Adding a new device schema");
    xmlschema = xmltojson.insertschematoDB(jsonobj);
    return xmlschema;
  } else if (compareSchema(check_uuid, jsonobj)){
    console.log("This device schema already exist");
    return xmlschema;
  } else {
    console.log("Adding updated device schema");
    xmlschema = xmltojson.insertschematoDB(jsonobj);
    return xmlschema;
  }
}

module.exports ={
  updateSchemaCollection,
};
