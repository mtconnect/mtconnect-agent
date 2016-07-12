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
const CBuffer = require('CBuffer');

// Imports - Internal

const log = require('./config/logger');

// Constants

const bufferSize = 10; // TODO: change it to the required buffer size

// Instances

const circularBuffer = new CBuffer(bufferSize); /* circular buffer */
const backUp = [];

let backUpVar = 0;


// Functions

/* ************************** Supporting functions ************************* */
/**
  * Check the array of dataitems for matching uuid, id and name
  *
  * @param arr {array}
  * @param uuidVal {String}
  * @param idVal {String}
  * @param nameVal {String}
  *
  * returns an array of filtered result
  *
  */


function filterChain(arr, uuidVal, idVal, nameVal) {
  const filter = R.pipe(R.values,
                        R.filter((v) => v.uuid === uuidVal),
                        R.filter((v) => v.id === idVal),
                        R.filter((v) => v.dataItemName === nameVal));
  const result = filter(arr);
  return result;
}

/**
  * gets called when the circularBuffer is upto overflow
  * data - the data which will get evicted
  *
  *
  */

circularBuffer.overflow = (data) => {
  const uuidVal = data.uuid;
  const idVal = data.id;
  const nameVal = data.dataItemName;

  // the 0th element will be the data to be evicted hence spliced from 1
  const cb = circularBuffer.slice(1, bufferSize);

  // checking the circularBuffer if any entry exist for the dataitem to be evicted
  const entryExist = filterChain(cb, uuidVal, idVal, nameVal);

 // if no entry is present, data should be backed up.
  if (entryExist.length === 0) {
    backUp[backUpVar++] = data;
    return;
  }
  return;
};


function readFromBackUp(uuidVal, idVal, nameVal) {
  log.debug('readFromBackUp', uuidVal, idVal, nameVal);
  const filteredList = filterChain(backUp, uuidVal, idVal, nameVal);
  log.debug('filteredList', filteredList);
  const result = filteredList[filteredList.length - 1];
  return result;
}

/**
  * updating the circular buffer after every insertion into DB
  *
  * @param obj = jsonData inserted in lokijs
  * { sequenceId: 0, id:'dtop_2', uuid:'000', time: '2',
  *    dataItemName:'avail', value: 'AVAILABLE' }
  *
  */
function updateCircularBuffer(obj) {
  const k = circularBuffer.toArray();
  if (k.length === 0) {  // isEmpty()
    circularBuffer.push({ dataItemName: obj.dataItemName, uuid: obj.uuid, id: obj.id,
    value: obj.value, sequenceId: obj.sequenceId });
  } else if ((k[0] !== undefined) && (k[bufferSize - 1] === undefined)) {
    circularBuffer.push({ dataItemName: obj.dataItemName, uuid: obj.uuid,
    id: obj.id, value: obj.value, sequenceId: obj.sequenceId });
  } else {
    circularBuffer.push({ dataItemName: obj.dataItemName, uuid: obj.uuid, id: obj.id,
    value: obj.value, sequenceId: obj.sequenceId });
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
function readFromCircularBuffer(ptr, idVal, uuidVal, nameVal) {
  const cbArr = ptr.toArray();
  const latestEntry = filterChain(cbArr, uuidVal, idVal, nameVal);
  let result = latestEntry[latestEntry.length - 1];
  if (result === undefined) {
    log.debug(' To be read from backUp');
    result = readFromBackUp(uuidVal, idVal, nameVal);
  }
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
  backUp,
  readFromCircularBuffer,
};
