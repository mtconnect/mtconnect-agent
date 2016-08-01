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
const converter = require('converter');
const moment = require('moment');
const dataStorage = require('./dataStorage');

/**
  * fillJSON() creates a JSON object with corresponding data values.
  *
  * @param {Object} latestSchema - latest device schema
  * @param {Object} DataItemvar - DataItems of a device updated with values
  *
  * returns the JSON object with all values
  *
  */

function updateJSON(latestSchema, DataItemVar) {
  const newTime = moment.utc().format();
  const dvcHeader = latestSchema[0].device.$;
  const cbuffer = dataStorage.circularBuffer;
  const k = cbuffer.toArray();

  const firstSequence = k[0].sequenceId;
  const lastSequence = k[k.length - 1].sequenceId;
  const nextSequence = lastSequence + 1;
  let newJSON = {};

  const componentName = 'Device';
  const newXMLns = { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  xmlns: 'urn:mtconnect.org:MTConnectStreams:1.3',
  'xmlns:m': 'urn:mtconnect.org:MTConnectStreams:1.3',
  'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectStreams:1.3 http://www.mtconnect.org/schemas/MTConnectStreams_1.3.xsd' };


  newJSON = { MTConnectStreams:
              { $: newXMLns,
                Header:
                  [{ $:
                    { creationTime: newTime,
                      assetBufferSize: '1024',
                      sender: 'localhost',
                      assetCount: '0',
                      version: '1.3',
                      instanceId: '0',
                      bufferSize: '524288',
                      nextSequence,
                      firstSequence,
                      lastSequence } }],
                Streams:
                [{ DeviceStream:
                  [{ $: { name: dvcHeader.name, uuid: dvcHeader.uuid, id: dvcHeader.id },
                     ComponentStreams:
                      [{ $: { component: componentName, name: latestSchema[0].device.$.name,
                                        componentId: latestSchema[0].device.$.id },
                         }],
                }] }] } };

  let componentObj = newJSON.MTConnectStreams.Streams[0].DeviceStream[0].ComponentStreams[0];
  componentObj.Event = DataItemVar.Event;
  componentObj.Sample = DataItemVar.Sample;
  componentObj.Condition = DataItemVar.Condition;
  return newJSON;
}


/**
  * jsonToXML() converts the JSON object to XML
  *
  * @param {String} source- stringified JSON object
  * @param {obj} res- response to browser
  *
  * write xml object as response in browser
  */
function jsonToXML(source, res) {
  const s = new stream.Readable();
  const w = new stream.Writable({ decodeStrings: false });
  let convert = {};
  let options = {};
  let xmlString = '';

  // converting json string to stream
  s._read = function noop() {
    this.push(source);
    this.push(null);
  };

  // writing stream to browser
  w._write = (chunk) => {
    xmlString = chunk.toString();
    res.writeHead(200, { 'Content-Type': 'text/plain',
                              Trailer: 'Content-MD5' });
    res.write(xmlString);
    res.addTrailers({ 'Content-MD5': '7895bf4b8828b55ceaf47747b4bca667' });
    res.end();
  };

  options = {
    from: 'json',
    to: 'xml',
  };
  convert = converter(options);
  s.pipe(convert).pipe(w);
}

// Exports

module.exports = {
  updateJSON,
  jsonToXML,
};
