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

// TODO: rename the file to dataStorage
// Imports - Internal

const lokijs = require('./lokijs');
const common = require('./common');
const LRUMap = require('collections/lru-map');

// Constants

const bufferSize = 10; // TODO: change it to the required buffer size
const rawData = lokijs.getRawDataDB();

// Instances

const circularBuffer = new LRUMap({}, bufferSize); /* circular buffer */

// variables

let sequenceId = 0; // TODO: sequenceId should be updated

/**
  * getId() get the Id for the dataitem from the deviceSchema
  *
  * @param {String} uuid
  * @param {String} dataItemName
  *
  * return id (Eg:'dtop_2')
  */
function getId(uuid, dataItemName) { // move to lokijs
  function isSameName(element) {
    if (element.$.name === dataItemName) {
      return true;
    }
    return false;
  }

  const schemaPtr = lokijs.getSchemaDB();
  // TODO: Can make a seperate function to find out recent entry from device schema collection
  const findUuid = schemaPtr.chain()
                            .find({ uuid })
                            .data();
  const dataItemS = findUuid[0].device.DataItems[0];
  const dataItem = dataItemS.DataItem;
  const index = dataItem.findIndex(isSameName);
  const id = dataItem[index].$.id;
  return id;
}

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

// TODO: corresponding id from getid

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
  */
rawData.on('insert', (obj) => {
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
});

/**
  * dataCollectionUpdate() inserts the shdr data into the shdr collection
  *
  * @param {Object} shdrarg - with dataitem and time
  * returns a ptr to the circularbuffer
  */
function dataCollectionUpdate(shdrarg) { // TODO: move to lokijs
  const dataitemno = shdrarg.dataitem.length;
  //const dataarr = common.fillArray(dataitemno);
  const uuid = getUuid();
  for (var i =0; i < dataitemno; i++) {
    const dataItemName = shdrarg.dataitem[i].name;
    const id = getId(uuid, dataItemName);
    rawData.insert({ sequenceId: sequenceId++, id, uuid, time: shdrarg.time,
                  dataItemName, value: shdrarg.dataitem[i].value });
  }
  return circularBuffer;
}

// Exports

module.exports = {
  getUuid,
  getId,
  inputParsing,
  dataCollectionUpdate,
  circularBuffer,
};
