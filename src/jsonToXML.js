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


/**
  * fillJSON() creates a JSON object with corresponding data values.
  *
  * @param {Object} latestSchema - latest device schema
  * @param {Object} DataItemvar - DataItems of a device updated with values
  *
  * returns the JSON object with all values
  *
  */

function updateJSON(latestSchema, DataItem) {
  const newXMLns = latestSchema[0].xmlns;
  const newTime = latestSchema[0].time;
  const dvcHeader = latestSchema[0].device.$;
  const dvcDescription = latestSchema[0].device.Description;
  let newJSON = {};

  newJSON = { MTConnectDevices: { $: newXMLns,
  Header: [{ $:
  { creationTime: newTime, assetBufferSize: '1024', sender: 'localhost', assetCount: '0',
  version: '1.3', instanceId: '0', bufferSize: '524288' } }],
  Devices: [{ Device: [{ $:
  { name: dvcHeader.name, uuid: dvcHeader.uuid, id: dvcHeader.id },
    Description: dvcDescription,
    DataItems: [{ DataItem }],
  }] }] } };

  return newJSON;
}


/**
  * jsonToXML() converts the JSON object to XML
  *
  * @param {String} source- stringified JSON object
  * @param {path to a file} destination
  *
  * returns xml object
  */
function jsonToXML(source, destination) {
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
  updateJSON,
  jsonToXML,
};
