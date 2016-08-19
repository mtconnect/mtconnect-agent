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
const R = require('ramda');

// Imports - Internal
const dataStorage = require('./dataStorage');

// functions

function findDataItem(arr, id) {
  let res;
  for (let i = 0; i < arr.length; i++) {
    const keys = R.keys(arr[i]);
    // k are the keys Eg: Availability, Load etc
    R.find((k) => {
    // pluck the properties of all objects corresponding to k
      if ((R.pluck(k, [arr[i]])) !== undefined) {
        const pluckedData = (R.pluck(k, [arr[i]]))[0]; // result will be an array
        if (pluckedData.$.dataItemId === id) {
          res = arr[i];
        }
      }
      return (res !== undefined); // to make eslint happy
    }, keys);
  }
  return res;
}


function parseCategorisedArray(category, id, type, DataItemVar) {
  if (category === 'EVENT') {
    const arr = DataItemVar.Event;
    const result = findDataItem(arr, id);
    return result;
  } else if (category === 'SAMPLE') {
    const arr = DataItemVar.Sample;
    const result = findDataItem(arr, id);
    return result;
  } // category === CONDITION
  const arr = DataItemVar.Condition;
  const result = findDataItem(arr, id);
  return result;
}


function parseDataItems(dataItems, DataItemVar) {
  const eventArr = [];
  const sampleArr = [];
  const conditionArr = [];
  const obj = {};
  for (let k = 0; k < dataItems.length; k++) {
    const dataItem = dataItems[k].DataItem;
    for (let l = 0, m = 0, n = 0, p = 0; l < dataItem.length; l++) {
      const id = dataItem[l].$.id;
      const type = dataItem[l].$.type;
      const category = dataItem[l].$.category;
      if (category === 'EVENT') {
        eventArr[p++] = parseCategorisedArray(category, id, type, DataItemVar);
      }
      if (category === 'SAMPLE') {
        sampleArr[m++] = parseCategorisedArray(category, id, type, DataItemVar);
      }
      if (category === 'CONDITION') {
        conditionArr[n++] = parseCategorisedArray(category, id, type, DataItemVar);
      }
    }
  }
  obj.eventArr = eventArr;
  obj.sampleArr = sampleArr;
  obj.conditionArr = conditionArr;
  return obj;
}


function createComponentStream(obj, componentName, name, id, componentObj) {
  const eventArr = obj.eventArr;
  const conditionArr = obj.conditionArr;
  const sampleArr = obj.sampleArr;
  const title = { $: { component: componentName, name,
                    componentId: id } };
  componentObj.push(title);
  const componentObj1 = componentObj;
  const len = componentObj.length - 1;

  if (eventArr.length !== 0) {
    componentObj1[len].Event = [];
    componentObj1[len].Event.push(eventArr);
  }
  if (sampleArr.length !== 0) {
    componentObj1[len].Sample = [];
    componentObj1[len].Sample.push(sampleArr);
  }
  if (conditionArr.length !== 0) {
    componentObj1[len].Condition = [];
    componentObj1[len].Condition.push(conditionArr);
  }
  return;
}

function parseLevelSix(container, componentObj, DataItemVar) {
  for (let i = 0; i < container.length; i++) {
    const keys = R.keys(container[i]);
    R.find((k) => {
      const pluckedData = (R.pluck(k)([container[i]]))[0]; // result will be an array
      const componentName = k;
      const name = pluckedData[0].$.name;
      const id = pluckedData[0].$.id;
      for (let j = 0; j < pluckedData.length; j++) {
        const dataItems = pluckedData[j].DataItems;
        const obj = parseDataItems(dataItems, DataItemVar);
        createComponentStream(obj, componentName, name, id, componentObj);
      }
      return 0; // to make eslint happy
    }, keys);
  }
}

function parseLevelFive(container, componentName, componentObj, DataItemVar) {
  for (let j = 0; j < container.length; j++) {
    const name = container[j].$.name;
    const id = container[j].$.id;

    if (container[j].DataItems !== undefined) {
      const dataItems = container[j].DataItems;
      const obj = parseDataItems(dataItems, DataItemVar);
      createComponentStream(obj, componentName, name, id, componentObj);
    }
    if (container[j].Components !== undefined) {
      parseLevelSix(container[j].Components, componentObj, DataItemVar);
    }
    return;
  }
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

// TODO: Update instanceId
function updateJSON(latestSchema, DataItemVar) {
  const xmlns = latestSchema[0].xmlns.xmlns;
  const arr = xmlns.split(':');
  const version = arr[arr.length - 1];
  const newTime = moment.utc().format();
  const dvcHeader = latestSchema[0].device.$;
  const cbuffer = dataStorage.circularBuffer;
  const k = cbuffer.toArray();
  let firstSequence;
  let lastSequence;

  if (k.length !== 0) {
    firstSequence = k[0].sequenceId;
    lastSequence = k[k.length - 1].sequenceId;
  } else {
    firstSequence = 0;
    lastSequence = 0;
  }

  const nextSequence = lastSequence + 1;
  const DataItems = latestSchema[0].device.DataItems;
  const Components = latestSchema[0].device.Components;
  let newJSON = {};

  const newXMLns = { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  xmlns: `urn:mtconnect.org:MTConnectStreams:${version}`,
  'xmlns:m': `urn:mtconnect.org:MTConnectStreams:${version}`,
  'xsi:schemaLocation': `urn:mtconnect.org:MTConnectStreams:${version} http://www.mtconnect.org/schemas/MTConnectStreams${version}.xsd` };

  newJSON = { MTConnectStreams:
              { $: newXMLns,
                Header:
                  [{ $:
                    { creationTime: newTime,
                      assetBufferSize: '1024',
                      sender: 'localhost',
                      assetCount: '0',
                      version,
                      instanceId: '0',
                      bufferSize: '10',
                      nextSequence,
                      firstSequence,
                      lastSequence } }],
                Streams:
                [{ DeviceStream:
                  [{ $: { name: dvcHeader.name, uuid: dvcHeader.uuid, id: dvcHeader.id },
                     ComponentStreams: [],
                }] }] } };

  const componentObj = newJSON.MTConnectStreams.Streams[0].DeviceStream[0].ComponentStreams;
  if (DataItems !== undefined) {
    const componentName = 'Device';
    const id = latestSchema[0].device.$.id;
    const name = latestSchema[0].device.$.name;
    const obj = parseDataItems(DataItems, DataItemVar);
    createComponentStream(obj, componentName, name, id, componentObj);
  }

  if (Components !== undefined) {
    for (let i = 0; i < Components.length; i++) {
      if (Components[i].Axes) {
        const componentName = 'Axes';
        parseLevelFive(Components[i].Axes, componentName, componentObj, DataItemVar);
      }
      if (Components[i].Controller) {
        const componentName = 'Controller';
        parseLevelFive(Components[i].Controller, componentName, componentObj, DataItemVar);
      }
      if (Components[i].Systems) {
        const componentName = 'Systems';
        parseLevelFive(Components[i].Systems, componentName, componentObj, DataItemVar);
      }
    }
  }
  return newJSON;
}

/**
  * sequenceIdError() creates the CDATA and errorCode for
  * the particular and append it to Errors
  * @param {Number} sequenceId (received in request)
  * @param {Object} errObj
  *
  */

function sequenceIdError(sequenceId, errorObj) {
  const param = '\'at\'';
  const sequenceObj = dataStorage.getSequence();
  const firstSeq = Number(sequenceObj.firstSequence);
  const lastSeq = Number(sequenceObj.lastSequence);
  const title = { $: { } };
  const errObj = errorObj;
  let CDATA;
  errObj.push(title);
  const len = errObj.length - 1;
  errObj[len].Error = [];
  
  if (sequenceId < 0) {
    CDATA = `${param} must be a positive integer.`;
  } else if (sequenceId < firstSeq) {
    CDATA = `${param} must be greater than or equal to ${firstSeq}.`;
  } else {
    CDATA = `${param} must be less than or equal to ${lastSeq}.`;
  }
  const obj = { $:
  {
    errorCode: 'OUT_OF_RANGE',
  },
  _: CDATA,
  };
  errObj[len].Error.push(obj);
  return;
}

function deviceError(value, errorObj) {
  const title = { $: { } };
  const errObj = errorObj;
  errObj.push(title);
  const len = errObj.length - 1;
  errObj[len].Error = [];
  const CDATA = `Could not find the device ${value}.`;
  const obj = { $:
  {
    errorCode: 'NO_DEVICE',
  },
  _: CDATA,
  };
  errObj[len].Error.push(obj);
  return;
}

/**
  * createErrorResponse() creates MTConnectError response
  * @param {Object} latestSchema
  * @param {String} errCategory (given to use this as a generic function)
  * @param {Any} value (depends on the errCategory)
  */
function createErrorResponse(errCategory, value) {
  // const xmlns = latestSchema[0].xmlns.xmlns;
  // const arr = xmlns.split(':');
  const version = 1.3;  // arr[arr.length - 1]; //TODO: move to config
  const newTime = moment.utc().format();

  const newXMLns = { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  xmlns: `urn:mtconnect.org:MTConnectError:${version}`,
  'xmlns:m': `urn:mtconnect.org:MTConnectError:${version}`,
  'xsi:schemaLocation': `urn:mtconnect.org:MTConnectError:${version} http://www.mtconnect.org/schemas/MTConnectError${version}.xsd` };

  let errorJSON = {};
  errorJSON = { MTConnectError:
                { $: newXMLns,
                  Header:
                   [{ $:
                     { creationTime: newTime,
                       sender: 'localhost',
                       instanceId: '0',
                       bufferSize: '10',
                       version,
                     } }],
                   Errors: [],
                },
              };
  const errorObj = errorJSON.MTConnectError.Errors;
  if (errCategory === 'SEQUENCEID') {
    sequenceIdError(value, errorObj);
  }
  if (errCategory === 'NO_DEVICE') {
    deviceError(value, errorObj);
  }
  return errorJSON;
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
    const resStr = xmlString.replace(/<[/][0-9]>[\n]|<[0-9]>[\n]/g, '\r');
    //TODO: remove blank lines
    res.writeHead(200, { 'Content-Type': 'text/plain',
                              Trailer: 'Content-MD5' });
    res.write(resStr);
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
  createErrorResponse,
};
