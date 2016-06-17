/**
  * Copyright 2016, System Insights, Inc.
  *
  * Licensed under the Apache License, Version 2.0 (the "License");
  * you may not use this file except in compliance with the License.
  * You may obtain a copy of the License at
  *
  *    http://www.apache.org/licenses/LICENSE-2.0
  *
  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
  */

// Imports - External

const R = require('ramda');
const stream = require('stream');
const fs = require('fs');
const converter = require('converter');

// Imports - Internal

const lokijs = require('./lokijs');
const common = require('./common');

/**
  * readFromCircularBuffer() gets the latest
  * value of the dataitem from circular buffer
  *
  * @param {Object} cbPtr -  pointer to circular buffer
  * @param {String} idVal
  * @param {String} uuidVal
  * @param {String} nameVal
  *
  * return the latest entry for that dataitem
  *
  */
function readFromCircularBuffer(cbPtr, idVal, uuidVal, nameVal) {
  const shdrObj = cbPtr.toObject();
  const bufferObjects = R.values(shdrObj);
  const sameUuid = R.filter((v) => v.uuid === uuidVal)(bufferObjects);
  const sameId = R.filter((v) => v.id === idVal)(sameUuid);
  const sameName = R.filter((v) => v.dataitemname === nameVal)(sameId);
  const result = sameName[sameName.length - 1];
  return result;
}

// TODO Function header
// Refactor into three functions
/**
  * searchDeviceSchema() searches the device schema collection
  * for the recent entry for the  given uuid
  *
  * @param {String} uuid
  *
  * returns the latest device schema entry for that uuid
  */
function searchDeviceSchema(uuid) {
  const resultdeviceschema = lokijs.getschemaDB();
  const searchresult = resultdeviceschema.chain()
                                         .find({ uuid })
                                         .sort('time')
                                         .data();
  return searchresult;
}

/**
  * getDataItem() gets the latest value for each DataItems
  * and append the value to DataItems object of type JSON.
  *
  * @param {Object) searchresult - latest deviceschema for uuid
  * @param {Object} circularBufferPtr
  *
  * return DataItemvar with latest value appended to it.
  */

function getDataItem(searchresult, circularBufferPtr) {
  const DataItemvar = [];
  const filterresult = [];
  const searchdevice0 = searchresult[0].device.DataItems[0];
  const numberofdataitems = searchdevice0.DataItem.length;
  const dsarr = common.fillArray(numberofdataitems);

  // finding the recent value and appending it for each DataItems
  dsarr.map((i) => {
    const dvcDataItem = searchdevice0.DataItem[i].$;
    filterresult[i] = readFromCircularBuffer(circularBufferPtr, dvcDataItem.id,
                                  searchresult[0].device.$.uuid, dvcDataItem.name);

    DataItemvar[i] = { $: { type: dvcDataItem.type,
                            category: dvcDataItem.category,
                            id: dvcDataItem.id,
                            name: dvcDataItem.name }, _: filterresult[i].value };
    return DataItemvar;
  });
  return DataItemvar;
}
/**
  * fillJSON() creates a JSON object with corresponding data values.
  *
  * @param {Object} searchresult - latest device schema
  * @param {Object} DataItemvar - DataItems of a device updated with values
  *
  * returns the JSON object with all values
  *
  */

function fillJSON(searchresult, DataItemvar) {
  const newxmlns = searchresult[0].xmlns;
  const newtime = searchresult[0].time;
  let newjson = {};

  // TODO make seperate function if required by getting dataitem from above
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

/**
  * convertToXML() converts the JSON object to XML
  *
  * @param {String} source- stringified JSON object
  * @param {path to a file} destination
  *
  * returns xml object
  */
function convertToXML(source, destination) {
  // Reading a string and creating a stream
  const s = new stream.Readable();
  let convert = {};
  let jsonreader = {};
  let xmlwriter = ''; // TODO check alternative way to prevent writing to a file.
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

// Exports

module.exports = {
  getDataItem,
  readFromCircularBuffer,
  fillJSON,
  searchDeviceSchema,
  convertToXML,
};
