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
let index = 0;

function parseCategorisedArray(category, id, type, DataItemVar) {
  let res;
  // console.log(require('util').inspect(DataItemVar, { depth: null }));
  function findDataItem(arr) {
    for (let i = 0; i < arr.length; i++) {
      const keys = R.keys(arr[i]);
      R.find((k) => {

      // pluck the properties of all objects corresponding to k
        if ((R.pluck(k)([arr[i]])) !== undefined) {
          const pluckedData = (R.pluck(k)([arr[i]]))[0]; // result will be an array
          if(pluckedData.$.dataItemId === id) {
            res = arr[i];
          }

        }
        return 0; // to make eslint happy
      }, keys);
    }
    return res;
  }

  if (category === 'EVENT') {
    arr = DataItemVar.Event;
    let result = findDataItem(arr);
    return result;
  } else if (category === 'SAMPLE') {
    arr = DataItemVar.Sample;
    let result = findDataItem(arr);
    return result;
  } else {
    arr = DataItemVar.Condition
    let result = findDataItem(arr);
    return result;
  }

}


function parseDataItems(dataItems, DataItemVar) {
  const eventArr = [];
  const sampleArr = [];
  const conditionArr = [];
  const obj = {}
  for (let k =0; k < dataItems.length; k++ ) {
    let dataItem = dataItems[k].DataItem;

    for (let l = 0, m = 0, n =0, p = 0; l < dataItem.length; l++) {
      id = dataItem[l].$.id;
      type = dataItem[l].$.type;
      category = dataItem[l].$.category;
      //console.log(id, type, category);
      if(category === 'EVENT') {
          eventArr[p++] = parseCategorisedArray(category, id, type, DataItemVar);
      }
      if(category === 'SAMPLE') {
        sampleArr[m++] = parseCategorisedArray(category, id, type, DataItemVar);
      }
      if(category === 'CONDITION') {
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
  Event = obj.eventArr;
  Condition = obj.conditionArr;
  Sample = obj.sampleArr;
  let title = { $: { component: componentName, name: name,
                    componentId: id } };
  componentObj.push(title);
  let len = componentObj.length - 1;
  if (Event.length !== 0) {
    componentObj[len].Event = []
    componentObj[len].Event.push(Event);
  }
  if (Sample.length !== 0) {
    componentObj[len].Sample = []
    componentObj[len].Sample.push(Sample);
  }
  if (Condition.length !== 0) {
    componentObj[len].Condition = [];
    componentObj[len].Condition.push(Condition);
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
  const firstSequence = k[0].sequenceId;
  const lastSequence = k[k.length - 1].sequenceId;
  const nextSequence = lastSequence + 1;
  const DataItems = latestSchema[0].device.DataItems;
  const Components = latestSchema[0].device.Components;
  const resultEvent = [];
  const resultSample = [];
  const resultCondition = [];
  let newJSON = {};

  const newXMLns = { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  xmlns: 'urn:mtconnect.org:MTConnectStreams:' + version,
  'xmlns:m': 'urn:mtconnect.org:MTConnectStreams:' + version,
  'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectStreams:'+ version+' http://www.mtconnect.org/schemas/MTConnectStreams_' + version + '.xsd' };


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
                      bufferSize: '524288',
                      nextSequence,
                      firstSequence,
                      lastSequence } }],
                Streams:
                [{ DeviceStream:
                  [{ $: { name: dvcHeader.name, uuid: dvcHeader.uuid, id: dvcHeader.id },
                     ComponentStreams: [ ],
                }] }] } };

  const componentObj = newJSON.MTConnectStreams.Streams[0].DeviceStream[0].ComponentStreams;
  if (DataItems !== undefined) {
    const componentName = 'Device';
    const id = latestSchema[0].device.$.id;
    const name = latestSchema[0].device.$.name;
    const obj = parseDataItems (DataItems, DataItemVar);
    createComponentStream(obj, componentName, name, id, componentObj);
  }

  if (Components !== undefined) {
    for (let i = 0; i < Components.length; i++) {
      if (Components[i].Axes) {
        const componentName = 'Axes';
        parseLevelFive(Components[i].Axes, componentName, componentObj, DataItemVar);
      }
      if (Components[i].Controller) {
        const componentName ='Controller';
        parseLevelFive(Components[i].Controller, componentName, componentObj, DataItemVar);
      }
      if (Components[i].Systems) {
        const componentName ='Systems';
        parseLevelFive(Components[i].Systems, componentName, componentObj, DataItemVar);
      }
    }
  }
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
    resstr = xmlString.replace(/<[/][0-9]>[\n]|<[0-9]>[\n]/g,
    function(g1, g2) {
      return '\r';
    });
    // resstr = resstr.trim()
    //console.log(require('util').inspect(resstr, { depth: null }));
    res.writeHead(200, { 'Content-Type': 'text/plain',
                              Trailer: 'Content-MD5' });
    res.write(resstr);
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
