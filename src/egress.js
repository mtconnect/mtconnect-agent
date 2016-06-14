/**
  *fns: readFromDataCollection, searchDeviceSchema, jsontoxml
  */
const lokijs = require('./lokijs');
const common = require('./common');
const R = require('ramda');
const stream = require('stream');
const fs = require('fs');
const converter = require('converter');


function readFromDataCollection(dbobj, idVal, uuidVal, nameVal) {
  const shdrObj = dbobj.toObject();
  const bufferObjects = R.values(shdrObj);
  const sameUuid = R.filter((v) => v.uuid === uuidVal)(bufferObjects);
  const sameId = R.filter((v) => v.id === idVal)(sameUuid);
  const sameName = R.filter((v) => v.dataitemname === nameVal)(sameId);
  const result = sameName[sameName.length - 1];
  return result;
}

function searchDeviceSchema(uuid, datacollectionptr) {
  const resultdeviceschema = lokijs.getschemaDB();
  const searchresult = resultdeviceschema.chain()
                                       .find({ uuid })
                                       .sort('time')
                                       .data();
  const DataItemvar = [];
  const filterresult = [];
  const newxmlns = searchresult[0].xmlns;
  const newtime = searchresult[0].time;
  const searchdevice0 = searchresult[0].device.DataItems[0];
  const numberofdataitems = searchdevice0.DataItem.length;
  const dsarr = common.fillArray(numberofdataitems);
  //let val;
  let newjson = {};

  dsarr.map((i) => {
    filterresult[i] = readFromDataCollection(datacollectionptr, searchdevice0.DataItem[i].$.id,
                                  searchresult[0].device.$.uuid, searchdevice0.DataItem[i].$.name);
    //val = filterresult[i].value;
    DataItemvar[i] = { $: { type: searchdevice0.DataItem[i].$.type,
                            category: searchdevice0.DataItem[i].$.category,
                            id: searchdevice0.DataItem[i].$.id,
                            name: searchdevice0.DataItem[i].$.name }, _: filterresult[i].value };
    return DataItemvar;
  });

  //TODO make seperate function if required by getting dataitem from above
  newjson = { MTConnectDevices: { $: newxmlns,
  Header: [{ $:
  { creationTime: newtime, assetBufferSize: '1024', sender: 'localhost', assetCount: '0',
  version: '1.3', instanceId: '0', bufferSize: '524288' } }],
  Devices: [{ Device: [{ $:
  { name: searchresult[0].device.$.name, uuid: searchresult[0].device.$.uuid,
    id: searchresult[0].device.$.id },
    Description: searchresult[0].device.Description,
    DataItems: [{ DataItem: DataItemvar }],
  }] }] } };

  return newjson;
}

function jsontoxml(source, destination) {
  // reading a string and creating a stream, not required when passing a file
  const s = new stream.Readable();
  let convert = {};
  let jsonreader = {};
  let xmlwriter = ''; //TODO check alternative way to prevent writing to a file.
  let options = {};
  s._read = function noop() {
    this.push(source);
    this.push(null);
  };

 // Use 'fs.createReadStream(source)' to pass a file in place of s
  jsonreader = s;
  xmlwriter = fs.createWriteStream(destination);
  options = {
    from: 'json',
    to: 'xml',
  };
  convert = converter(options);
  jsonreader.pipe(convert).pipe(xmlwriter);
  return destination;
}

module.exports = {
  readFromDataCollection,
  searchDeviceSchema,
  jsontoxml,
};
