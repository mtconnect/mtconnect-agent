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
const LRUMap = require('collections/lru-map');

// Imports - Internal

const common = require('./common');


// Constants

const bufferSize = 10; // TODO: change it to the required buffer size

// Instances

const circularBuffer = new LRUMap({}, bufferSize); /* circular buffer */


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
function readFromCircularBuffer(cbPtr, idVal, uuidVal, nameVal) { // move to shdrcollection
  const shdrObj = cbPtr.toObject();
  const bufferObjects = R.values(shdrObj);
  // console.log(require('util').inspect(bufferObjects, { depth: null }));
  const sameUuid = R.filter((v) => v.uuid === uuidVal)(bufferObjects);
  const sameId = R.filter((v) => v.id === idVal)(sameUuid);
  const sameName = R.filter((v) => v.dataItemName === nameVal)(sameId);
  const result = sameName[sameName.length - 1];
  return result;
}


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
    recentDataEntry[i] = readFromCircularBuffer(circularBufferPtr, dvcDataItem.id,
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
  * updating the circular buffer after every insertion into DB
  *
  * @param obj = jsonData inserted in lokijs
  * { sequenceId: 0, id:'dtop_2', uuid:'innovaluesthailand_CINCOMA26-1_b77e26', time: '2',
  *    dataItemName:'avail', value: 'AVAILABLE' }
  *
  * return circularBuffer
  */
function updateCircularBuffer(obj) {
  let k = circularBuffer.keys();
  if (k.length === 0) {
    circularBuffer.add({ dataItemName: obj.dataItemName, uuid: obj.uuid, id: obj.id,
    value: obj.value }, obj.sequenceId);
    k = circularBuffer.keys();
  } else if ((k[0]) && (k[bufferSize - 1] === undefined)) {
    circularBuffer.add({ dataItemName: obj.dataItemName, uuid: obj.uuid,
    id: obj.id, value: obj.value }, obj.sequenceId);
    k = circularBuffer.keys();
  } else {
    k = circularBuffer.keys();
    circularBuffer.add({ dataItemName: obj.dataItemName, uuid: obj.uuid, id: obj.id,
    value: obj.value }, obj.sequenceId);
    k = circularBuffer.keys();
  }
  return circularBuffer;
}


// Exports

module.exports = {
  getDataItem,
  updateCircularBuffer,
  circularBuffer,
  readFromCircularBuffer,
};
