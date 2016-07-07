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

// Constants

const bufferSize = 10; // TODO: change it to the required buffer size

// Instances

const circularBuffer = new LRUMap({}, bufferSize); /* circular buffer */

// Functions

/**
  * updating the circular buffer after every insertion into DB
  *
  * @param obj = jsonData inserted in lokijs
  * { sequenceId: 0, id:'dtop_2', uuid:'000', time: '2',
  *    dataItemName:'avail', value: 'AVAILABLE' }
  *
  *
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
  return;
}


/**
  * readFromCircularBuffer() gets the latest
  * value of the dataitem from circular buffer
  *
  * @param {Object} ptr -  pointer to circular buffer
  * @param {String} idVal
  * @param {String} uuidVal
  * @param {String} nameVal
  *
  * return the latest entry for that dataitem
  *
  */
function readFromCircularBuffer(ptr, idVal, uuidVal, nameVal) { // move to shdrcollection
  const filterChain = R.pipe(R.values,
                             R.filter((v) => v.uuid === uuidVal),
                             R.filter((v) => v.id === idVal),
                             R.filter((v) => v.dataItemName === nameVal));
  // calling the piped functions with ptr.toObject() as args
  const latestEntry = filterChain(ptr.toObject());
  const result = latestEntry[latestEntry.length - 1];
  return result;
}


/**
  * getDataItem() gets the latest value for each DataItems
  * and append the value to DataItems object of type JSON.
  *
  * @param {Object) latestSchema - latest deviceSchema for uuid
  * @param {Object} circularBufferPtr
  *
  * return DataItemVar with latest value appended to it.
  */
function getDataItem(latestSchema, circularBufferPtr) {
  const DataItemVar = [];
  const recentDataEntry = [];
  const dataItems0 = latestSchema[0].device.DataItems[0];
  const numberOfDataItems = dataItems0.DataItem.length;

  // finding the recent value and appending it for each DataItems
  for (let i = 0; i < numberOfDataItems; i++) {
    const dvcDataItem = dataItems0.DataItem[i].$;
    recentDataEntry[i] = readFromCircularBuffer(circularBufferPtr, dvcDataItem.id,
                                  latestSchema[0].device.$.uuid, dvcDataItem.name);

    DataItemVar[i] = { $: { type: dvcDataItem.type,
                            category: dvcDataItem.category,
                            id: dvcDataItem.id,
                            name: dvcDataItem.name }, _: recentDataEntry[i].value };
  }
  return DataItemVar;
}


// Exports

module.exports = {
  getDataItem,
  updateCircularBuffer,
  circularBuffer,
  readFromCircularBuffer,
};
