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

function parseCategorisedArray(category, id, type, DataItemVar, componentObj) {
  // console.log('**************************************************');
  // console.log(category, id, type);
  // console.log(require('util').inspect(DataItemVar, { depth: null }));
  // console.log(require('util').inspect(componentObj, { depth: null }));
  let res;

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
  } else { //TODO check whether for conditions this work ?
     arr = DataItemVar.Condition
     let result = findDataItem(arr);
     return result;
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
    let componentName = 'Device';
    for (let i = 0, k = 0, l = 0, m = 0; i < DataItems.length; i++) {
      DataItem = DataItems[i].DataItem;

      for(let j = 0; j < DataItem.length; j++) {
        let category = DataItems[i].DataItem[j].$.category;
        let id =  DataItems[i].DataItem[j].$.id;
        let type = DataItems[i].DataItem[j].$.type;
        if(category === 'EVENT') {
            resultEvent[k++] = parseCategorisedArray(category, id, type, DataItemVar, componentObj);
        }
        if(category === 'SAMPLE') {
          resultSample[l++] = parseCategorisedArray(category, id, type, DataItemVar, componentObj);
        }
        if(category === 'CONDITION') {
          resultCondition[m++] = parseCategorisedArray(category, id, type, DataItemVar, componentObj);
        }
      }

      Event = resultEvent;
      Condition = resultCondition;
      Sample = resultSample;
      let title = { $: { component: componentName, name: latestSchema[0].device.$.name,
                        componentId: latestSchema[0].device.$.id }};
      componentObj.push(title);
      let len = componentObj.length -1;

      if (Event.length !== 0) {
        componentObj[len].Event = Event;

      }
      if (Condition.length !== 0) {
        componentObj[len].Condition = Condition;
      }
      if (Sample.length !== 0) {
        componentObj[len].Sample = Sample;
      }

    }
  }

  if (Components !== undefined) {
    for (let i = 0; i < Components.length; i++) {
      if (Components[i].Controller) {
         let controller = Components[i].Controller;
         for (let j = 0; j < controller.length; j++) {
            let componentName ='Controller';
            let name = controller[j].$.name;
            let id = controller[j].$.id;

            if(controller[j].DataItems !== undefined) {
              let dataItems = controller[j].DataItems
              let eventArr = [];
              let sampleArr = [];
              let conditionArr = [];
              for (let k =0; k < dataItems.length; k++ ) {
                let dataItem = dataItems[k].DataItem;

                for (let l = 0, m = 0, n =0, p = 0; l < dataItem.length; l++) {
                  id = dataItem[l].$.id;
                  type = dataItem[l].$.type;
                  category = dataItem[l].$.category;

                  if(category === 'EVENT') {
                      eventArr[p++] = parseCategorisedArray(category, id, type, DataItemVar, componentObj);
                  }
                  if(category === 'SAMPLE') {
                    sampleArr[m++] = parseCategorisedArray(category, id, type, DataItemVar, componentObj);
                  }
                  if(category === 'CONDITION') {
                    conditionArr[n++] = parseCategorisedArray(category, id, type, DataItemVar, componentObj);
                  }
                }
              }
              // Event = eventArr;
              Condition = conditionArr;
              Sample =sampleArr;
              let title = { $: { component: componentName, name: name,
                                componentId: id } };
              componentObj.push(title);
              let len = componentObj.length - 1;
              console.log(require('util').inspect(eventArr[0], { depth: null }));
              if (Event.length !== 0) {
                componentObj[len].Event = []
                //R.assoc(componentObj[len].Event, Event, {} )
                componentObj[len].Event.push(eventArr);
              }
              if (Sample.length !== 0) {
                componentObj[len].Sample = Sample;
              }
              if (Condition.length !== 0) {
                componentObj[len].Condition = Condition;
              }
            }

         }
      }
    }
  }


  //console.log(require('util').inspect(componentObj[0], { depth: null }));
  // componentObj.Event = DataItemVar.Event;
  // componentObj.Sample = DataItemVar.Sample;
  // componentObj.Condition = DataItemVar.Condition;
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
