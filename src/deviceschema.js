/**
  * fns: updateSchemaCollection, compareSchema
  */
const lokijs = require('./lokijs');
const xmltojson = require('./xmltojson');
const R = require('ramda');

function compareSchema(foundfromdc, newobj) {
  const dcheader = foundfromdc[0].xmlns;
  const dctime = foundfromdc[0].time;
  const dcdevice = foundfromdc[0].device;
  const newheader = newobj.MTConnectDevices.$;
  const newtime = newobj.MTConnectDevices.Header[0].$.creationTime;
  const newdevice = newobj.MTConnectDevices.Devices[0].Device[0];

  if (R.equals(dcheader, newheader)) {
    if (R.equals(dctime, newtime)) {
      if (R.equals(dcdevice, newdevice)) {
        return true;
      } return false;
    } return false;
  } return false;
}

function updateSchemaCollection(schemareceived) {
  const jsonobj = xmltojson.xmltojson(schemareceived);
  const uuid = jsonobj.MTConnectDevices.Devices[0].Device[0].$.uuid;
  const schemaptr = lokijs.getschemaDB();
  const checkUuid = schemaptr.chain()
                             .find({ uuid })
                             .data();
  let xmlschema;

  if (!checkUuid.length) {
    console.log('Adding a new device schema');
    xmlschema = xmltojson.insertschematoDB(jsonobj);
    return xmlschema;
  } else if (compareSchema(checkUuid, jsonobj)) {
    console.log('This device schema already exist');
    return xmlschema;
  }
  console.log('Adding updated device schema');
  xmlschema = xmltojson.insertschematoDB(jsonobj);
  return xmlschema;
}

module.exports = {
  updateSchemaCollection,
};
