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

// Imports - Internal

const common = require('./common');
const LRUMap = require('collections/lru-map');

// Constants

const bufferSize = 10; // TODO: change it to the required buffer size

// Instances

const circularBuffer = new LRUMap({}, bufferSize); /* circular buffer */

// variables

/**
  * getUuid() returns the UUID
  *
  * @param  null
  *
  */
function getUuid() {
  const uuid = 'innovaluesthailand_CINCOMA26-1_b77e26'; // TODO: insert the corresponding uuid
  return uuid;
}

/**
  * inputParsing get the data from adapter, do string parsing
  * @param {string} inputParsing
  *
  * returns jsonData with time and dataitem
  */
function inputParsing(inputString) { // ('2014-08-11T08:32:54.028533Z|avail|AVAILABLE')
  const inputParse = inputString.split('|');
  const totalDataItem = (inputParse.length - 1) / 2;
  const jsonData = {
    time: inputParse[0],
    dataitem: [],
  };
  for (let i = 0, j = 1; i < totalDataItem; i++, j += 2) {
    // to getrid of edge conditions eg: 2016-04-12T20:27:01.0530|logic1|NORMAL||||
    if (inputParse[j]) {
      // dataitem[i] = { name: (avail), value: (AVAILABLE) };
      jsonData.dataitem.push({ name: inputParse[j], value: inputParse[j + 1] });
    }
  }
  return jsonData;
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
function postInsertFn(obj) {
  let keyarray = circularBuffer.keys();
  if (keyarray.length === 0) {
    circularBuffer.add({ dataItemName: obj.dataItemName, uuid: obj.uuid, id: obj.id,
    value: obj.value }, obj.sequenceId);
    keyarray = circularBuffer.keys();
  } else if ((keyarray[0]) && (keyarray[bufferSize - 1] === undefined)) {
    circularBuffer.add({ dataItemName: obj.dataItemName, uuid: obj.uuid,
    id: obj.id, value: obj.value }, obj.sequenceId);
    keyarray = circularBuffer.keys();
  } else {
    keyarray = circularBuffer.keys();
    circularBuffer.add({ dataItemName: obj.dataItemName, uuid: obj.uuid, id: obj.id,
    value: obj.value }, obj.sequenceId);
    keyarray = circularBuffer.keys();
  }
  return circularBuffer;
}


// Exports

module.exports = {
  getUuid,
  inputParsing,
  postInsertFn,
  circularBuffer,
};
