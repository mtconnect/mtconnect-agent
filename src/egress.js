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

const stream = require('stream');
const fs = require('fs');
const converter = require('converter');

// Imports - Internal

const common = require('./common');
const dataStorage = require('./dataStorage');

// TODO Function header
// Refactor into three functions


/**
  * getDataItem() gets the latest value for each DataItems
  * and append the value to DataItems object of type JSON.
  *
  * @param {Object) latestSchema - latest deviceSchema for uuid
  * @param {Object} circularBufferPtr
  *
  * return DataItemvar with latest value appended to it.
  */

function getDataItem(latestSchema, circularBufferPtr) {
  const DataItemvar = [];
  const recentDataEntry = [];
  const dataItems0 = latestSchema[0].device.DataItems[0];
  const numberOfDataItems = dataItems0.DataItem.length;
  const deviceSchemaArray = common.fillArray(numberOfDataItems);

  // finding the recent value and appending it for each DataItems
  deviceSchemaArray.map((i) => {
    const dvcDataItem = dataItems0.DataItem[i].$;
    recentDataEntry[i] = dataStorage.readFromCircularBuffer(circularBufferPtr, dvcDataItem.id,
                                  latestSchema[0].device.$.uuid, dvcDataItem.name);
    // console.log(require('util').inspect(recentDataEntry[i], { depth: null }));
    DataItemvar[i] = { $: { type: dvcDataItem.type,
                            category: dvcDataItem.category,
                            id: dvcDataItem.id,
                            name: dvcDataItem.name }, _: recentDataEntry[i].value };
    // console.log(require('util').inspect( DataItemvar[i], { depth: null }));
    return DataItemvar;
  });
  return DataItemvar;
}
/**
  * fillJSON() creates a JSON object with corresponding data values.
  *
  * @param {Object} latestSchema - latest device schema
  * @param {Object} DataItemvar - DataItems of a device updated with values
  *
  * returns the JSON object with all values
  *
  */

function fillJSON(latestSchema, DataItemvar) {
  const newXMLns = latestSchema[0].xmlns;
  const newTime = latestSchema[0].time;
  let newJSON = {};

  // TODO make seperate function if required by getting dataitem from above
  newJSON = { MTConnectDevices: { $: newXMLns,
  Header: [{ $:
  { creationTime: newTime, assetBufferSize: '1024', sender: 'localhost', assetCount: '0',
  version: '1.3', instanceId: '0', bufferSize: '524288' } }],
  Devices: [{ Device: [{ $:
  { name: latestSchema[0].device.$.name, uuid: latestSchema[0].device.$.uuid,
    id: latestSchema[0].device.$.id },
    Description: latestSchema[0].device.Description,
    DataItems: [{ DataItem: DataItemvar }],
  }] }] } };

  return newJSON;
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
  let jsonReader = {};
  let xmlWriter = ''; // TODO check alternative way to prevent writing to a file.
  let options = {};
  s._read = function noop() {
    this.push(source);
    this.push(null);
  };

  // Use 'fs.createReadStream(source)' to pass a file in place of s
  jsonReader = s;
  xmlWriter = fs.createWriteStream(destination);
  options = {
    from: 'json',
    to: 'xml',
  };
  convert = converter(options);
  jsonReader.pipe(convert).pipe(xmlWriter);
  return destination;
}

// Exports

module.exports = {
  getDataItem,

  fillJSON,
  convertToXML,
};
