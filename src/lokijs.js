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

// TODO: Use module import/export

// Imports - External

const Loki = require('lokijs');

// Imports - Internal

const dataStorage = require('./dataStorage');

// Instances

const Db = new Loki('loki.json');

// Constants - datacollection pointers

const rawData = Db.addCollection('rawData'); // TODO change shdr collection to data collection (done)
const mtcDevices = Db.addCollection('DeviceDefinition');

// variables

let sequenceId = 0; // TODO: sequenceId should be updated
let circularBuffer;

// ******************** Raw Data Collection *******************//

/**
  * getRawDataDB() returns the SHDR collection
  * ptr in lokijs database
  *
  * @param = null
  */
function getRawDataDB() {
  return rawData;
}


/**
  * post insert listener
  * calling function postInsertFn on every insert to lokijs
  *
  *  @param obj = jsonData inserted in lokijs
  * { sequenceId: 0, id:'dtop_2', uuid:'innovaluesthailand_CINCOMA26-1_b77e26', time: '2',
  *    dataItemName:'avail', value: 'AVAILABLE' }
  */
rawData.on('insert', (obj) => {
  circularBuffer = dataStorage.postInsertFn(obj);
});

/**
  * dataCollectionUpdate() inserts the shdr data into the shdr collection
  *
  * @param {Object} shdrarg - with dataitem and time
  * returns a ptr to the circularbuffer
  */
function dataCollectionUpdate(shdrarg) { // TODO: move to lokijs
  const dataitemno = shdrarg.dataitem.length;
  const uuid = dataStorage.getUuid();
  for (var i =0; i < dataitemno; i++) {
    const dataItemName = shdrarg.dataitem[i].name;
    const id = getId(uuid, dataItemName);
    rawData.insert({ sequenceId: sequenceId++, id, uuid, time: shdrarg.time,
                  dataItemName, value: shdrarg.dataitem[i].value });
  }
  // console.log(require('util').inspect(circularBuffer.toObject(), { depth: null }));
  return circularBuffer;
}

// ******************** Device Schema Collection *******************//
/**
  * getSchemaDB() returns the deviceSchema
  * collection ptr in lokijs database
  *
  * @param = null
  */
function getSchemaDB() {
  return mtcDevices;
}

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

  const schemaPtr = getSchemaDB();
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

// Exports

module.exports = {
  getRawDataDB,
  getSchemaDB,
  getId,
  dataCollectionUpdate,
};
