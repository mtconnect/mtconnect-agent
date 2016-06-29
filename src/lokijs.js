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

const common = require('./common');
const Loki = require('lokijs');
const R = require('ramda');

// Imports - Internal

const dataStorage = require('./dataStorage');
const xmlToJSON = require('./xmlToJSON');
const log = require('./config/logger');

// Instances

const Db = new Loki('loki.json');

// Constants - datacollection pointers

// TODO change shdr collection to data collection (done)
const rawData = Db.addCollection('rawData');
const mtcDevices = Db.addCollection('DeviceDefinition');

// variables

let sequenceId = 0; // TODO: sequenceId should be updated
let circularBuffer;


/* ******************** Device Schema Collection ****************** */
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
  * read objects from json and insert into collection
  * @param {Object} parsedData (JSONObj)
  * return mtcDevices (ptr to db)
  */
function insertSchemaToDB(parsedData) {
  const parsedDevice = parsedData.MTConnectDevices;
//  const devices = parsedDevice.Devices;
//  console.log(require('util').inspect(parsedDevice, { depth: null }));
  const devices0 = parsedDevice.Devices[0]; // TODO : make more generic move inside for loop
  const xmlns = parsedDevice.$;
  const timeVal = parsedDevice.Header[0].$.creationTime;
  const numberOfDevices = parsedDevice.Devices.length;
  const numberOfDevice = devices0.Device.length;
  const uuid = [];
  const device = [];
  const name = [];

  for (let j = 0; j < numberOfDevices; j++) {
    //
    for (let i = 0; i < numberOfDevice; i++) {
      device[i] = devices0.Device[i];
      name[i] = device[i].$.name;
      uuid[i] = device[i].$.uuid;
      mtcDevices.insert({ xmlns, time: timeVal, name: name[i],
      uuid: uuid[i], device: device[i] });
      //initaiteCircularBuffer(parsedData, i, j, timeVal, uuid);
    }
  }
  // console.log('inserted schema to db')

  return mtcDevices;
}

/**
  * searchDeviceSchema() searches the device schema collection
  * for the recent entry for the  given uuid
  *
  * @param {String} uuid
  *
  * returns the latest device schema entry for that uuid
  */
function searchDeviceSchema(uuid) {
  const deviceSchemaPtr = getSchemaDB();
  const latestSchema = deviceSchemaPtr.chain()
                                      .find({ uuid })
                                      .sort('time')
                                      .data();
  return latestSchema;
}


/**
  * compareSchema() checks for duplicate entry
  * @param {object} foundFromDc - existing device schema
  * entry in database with same uuid.
  * @param {object} newObj - received schema in JSON
  * returns true if the existing schema is same as the new schema
  */
function compareSchema(foundFromDc, newObj) {
  const dcHeader = foundFromDc[0].xmlns;
  const dcTime = foundFromDc[0].time;
  const dcDevice = foundFromDc[0].device;
  const newHeader = newObj.MTConnectDevices.$;
  const newTime = newObj.MTConnectDevices.Header[0].$.creationTime;
  const newDevice = newObj.MTConnectDevices.Devices[0].Device[0];

  if (R.equals(dcHeader, newHeader)) {
    if (R.equals(dcTime, newTime)) {
      if (R.equals(dcDevice, newDevice)) {
        return true;
      } return false;
    } return false;
  } return false;
}

/**
  * updateSchemaCollection() updates the DB with newly received schema
  * after checking for duplicates
  * @param {object} schemaReceived - XML from http.get
  * returns the lokijs DB ptr
  */
function updateSchemaCollection(schemaReceived) {
  const jsonObj = xmlToJSON.xmlToJSON(schemaReceived);
  const uuid = jsonObj.MTConnectDevices.Devices[0].Device[0].$.uuid;
  const xmlSchema = getSchemaDB();
  const checkUuid = xmlSchema.chain()
                             .find({ uuid })
                             .data();


  if (!checkUuid.length) {
    log.debug('Adding a new device schema');
    insertSchemaToDB(jsonObj);
  } else if (compareSchema(checkUuid, jsonObj)) {
    log.debug('This device schema already exist');
  } else {
    log.debug('Adding updated device schema');
    insertSchemaToDB(jsonObj);
  }

  return xmlSchema;
}


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

  const findUuid = searchDeviceSchema(uuid);
  const dataItems = findUuid[0].device.DataItems[0];
  const dataItem = dataItems.DataItem;
  const index = dataItem.findIndex(isSameName);
  const id = dataItem[index].$.id;
  return id;
}

/**
  * post insert listener
  * calling function updateCircularBuffer on every insert to lokijs
  *
  *  @param obj = jsonData inserted in lokijs
  * { sequenceId: 0, id:'dtop_2', uuid:'000', time: '2',
  *    dataItemName:'avail', value: 'AVAILABLE' }
  */
rawData.on('insert', (obj) => {
  circularBuffer = dataStorage.updateCircularBuffer(obj);
});

/**
  * dataCollectionUpdate() inserts the shdr data into the shdr collection
  *
  * @param {Object} shdrarg - with dataitem and time
  * returns a ptr to the circularbuffer
  */
function dataCollectionUpdate(shdrarg) { // TODO: move to lokijs
  const dataitemno = shdrarg.dataitem.length;
  const uuid = common.getUuid();
  for (let i = 0; i < dataitemno; i++) {
    const dataItemName = shdrarg.dataitem[i].name;
    const id = getId(uuid, dataItemName);
    rawData.insert({ sequenceId: sequenceId++, id, uuid, time: shdrarg.time,
                  dataItemName, value: shdrarg.dataitem[i].value });
  }
  return circularBuffer;
}

/* ****************Second Round*********************************** */

function initaiteCircularBuffer(parsedData, i, j, time, uuid) {
  const parsedDevice = parsedData.MTConnectDevices;
  const devices0 = parsedDevice.Devices[0];
  const numberofDataItems = devices0.Device[0].DataItems.length;
  const numberofDataItem = devices0.Device[0].DataItems[0].DataItem.length;
  //const uuid = common.getUuid();
  for (let k = 0; k < numberofDataItems; k++) {
    for (let l = 0; l < numberofDataItem; l++) {
      // instead of parsed data try to pass device = Device[j]
      const dataItemName = parsedDevice.Devices[i].Device[j].DataItems[k].DataItem[l].$.name;
      const id = getId(uuid, dataItemName);
      // console.log(i, j, k, l, dataItemName, id)
      rawData.insert({ sequenceId: sequenceId++, id, uuid, time,
                      dataItemName, value: 'UNAVAILABLE' });
    }
  }
  return;
}


// Exports

module.exports = {
  compareSchema,
  dataCollectionUpdate,
  getRawDataDB,
  getSchemaDB,
  getId,
  insertSchemaToDB,
  searchDeviceSchema,
  updateSchemaCollection,
};
