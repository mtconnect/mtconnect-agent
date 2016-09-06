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
const moment = require('moment');
// Imports - Internal

const dataStorage = require('./dataStorage');
const xmlToJSON = require('./xmlToJSON');
const log = require('./config/logger');

// Instances

const Db = new Loki('loki.json');

// Constants - datacollection pointers

const rawData = Db.addCollection('rawData');
const mtcDevices = Db.addCollection('DeviceDefinition');

// variables

let sequenceId = 1; // TODO: sequenceId should be updated
let dataItemsArr = [];
let d = 0;

/* ********************** support functions *************************** */
/**
  * initiateCircularBuffer() inserts default value for each dataitem (from the schema)
  * in to the database which in turn updates circular buffer, hashCurrent and hashLast.
  *
  * @param = {object} dataitem: Array of all dataItem for each devices in  schema
  * @param = {String} time: time from deviceSchema
  * @param = {String} uuid: UUID from deviceSchema
  */

// TODO: change spelling
function initiateCircularBuffer(dataItem, time, uuid) {
  R.map((k) => {
    const dataItemName = k.$.name;
    const id = k.$.id;
    const path = k.path;

    const obj = { sequenceId: sequenceId++, id, uuid, time, path,
                   value: 'UNAVAILABLE' };
    if (dataItemName !== undefined) {
      obj.dataItemName = dataItemName;
    }
    rawData.insert(obj);
    dataStorage.hashCurrent.set(id, obj);
    dataStorage.hashLast.set(id, obj);
    return 0; // to make eslint happy
  }, dataItem);
}


/**
  * dataItemsParse() creates a dataItem array containing all dataItem from the schema
  *
  * @param {Object} container
  *
  */
function dataItemsParse(dataItems, path) {
  for (let i = 0; i < dataItems.length; i++) {
    const dataItem = dataItems[i].DataItem;
    for (let j = 0; j < dataItem.length; j++) {
      if (dataItem[j] !== undefined) {
        const path3 = `${path}//DataItem`;
        const dataItemObj = R.clone(dataItem[j]);
        dataItemObj.path = path3;
        dataItemsArr[d++] = dataItemObj;
      }
    }
  }
}

/**
  * levelSixParse() separates DataItems in level six and passes them to dataItemsParse
  *
  *
  * @param {Object} container
  *
  */
function levelSixParse(container, path) {
  for (let i = 0; i < container.length; i++) {
    const keys = R.keys(container[i]);
    // k = element of array keys
    R.find((k) => {
    // pluck the properties of all objects corresponding to k
      if ((R.pluck(k)([container[i]])) !== undefined) {
        const pluckedData = (R.pluck(k)([container[i]]))[0]; // result will be an array

        for (let j = 0; j < pluckedData.length; j++) {
          const path1 = `${path}//${k}`;
          const dataItems = pluckedData[j].DataItems;
          dataItemsParse(dataItems, path1);
        }
      }
      return 0; // to make eslint happy
    }, keys);
  }
}


/**
  * levelFiveParse() separates Components and DataItems in level five
  * and call parsing in next level.
  *
  * @param {Object} container
  *
  */
function levelFiveParse(container, path) {
  for (let i = 0; i < container.length; i++) {
    if (container[i].Components !== undefined) {
      levelSixParse(container[i].Components, path);
    }
    if (container[i].DataItems !== undefined) {
      dataItemsParse(container[i].DataItems, path);
    }
  }
}


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
                                      .simplesort('time')
                                      .data();
  return latestSchema;
}


/**
  * getDataItem() get all the dataItem(s) from the deviceSchema
  *
  * @param {String} uuid
  *
  * return {Array} dataItemsArr
  */
function getDataItem(uuid) {
  dataItemsArr = [];
  let path = '';
  d = 0;
  const findUuid = searchDeviceSchema(uuid);
  if (findUuid.length === 0) {
    return null;
  }

  const device = findUuid[findUuid.length - 1].device;
  const deviceName = device.$.name;
  if (!R.isEmpty(device)) {
    path = `//Devices//Device[@name=\"${deviceName}\"]`;
  }
  const dataItems = device.DataItems;
  const components = device.Components;
  if (dataItems !== undefined) {
    dataItemsParse(dataItems, path);
  }
  if (components !== undefined) {
    for (let i = 0; i < components.length; i++) {
      if (components[i].Axes !== undefined) {
        let path1 = `${path}//Axes`;
        levelFiveParse(components[i].Axes, path1);
      }
      if (components[i].Controller !== undefined) {
        let path2 = `${path}//Controller`;
        levelFiveParse(components[i].Controller, path2);
      }
      if (components[i].Systems !== undefined) {
        let path3 = `${path}//Systems`;
        levelFiveParse(components[i].Systems, path3);
      }
    }
  }
  return dataItemsArr;
}


/**
  * read objects from json and insert into collection
  * @param {Object} parsedData (JSONObj)
  *
  */
function insertSchemaToDB(parsedData) {
  const parsedDevice = parsedData.MTConnectDevices;
  const devices = parsedDevice.Devices;
  const xmlns = parsedDevice.$;
  const timeVal = parsedDevice.Header[0].$.creationTime;
  const numberOfDevices = devices.length;

  const uuid = [];
  const device = [];
  const name = [];

  for (let i = 0; i < numberOfDevices; i++) {
    const devices0 = devices[i];
    const numberOfDevice = devices0.Device.length;
    for (let j = 0; j < numberOfDevice; j++) {
      device[j] = devices0.Device[j];
      name[j] = device[j].$.name;
      uuid[j] = device[j].$.uuid;
      mtcDevices.insert({ xmlns, time: timeVal, name: name[j],
      uuid: uuid[j], device: device[j] });

      const dataItemArray = getDataItem(uuid[j]);
      initiateCircularBuffer(dataItemArray, timeVal, uuid[j]);
    }
  }
  return;
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
function updateSchemaCollection(schemaReceived) { //TODO check duplicate first.
  const jsonObj = xmlToJSON.xmlToJSON(schemaReceived);
  if (jsonObj !== undefined) {
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
      insertSchemaToDB(jsonObj);
      log.debug('Adding updated device schema');
    }
  } else
  {
    log.debug('xml parsing failed');
  }
  return;
}


// ******************** Raw Data Collection ******************* //

/**
  * getRawDataDB() returns the SHDR collection
  * ptr in lokijs database
  *
  * @param = null
  */
function getRawDataDB() {
  return rawData;
}

function getPath(uuid, dataItemName) {
  const dataItemArray = getDataItem(uuid);
  let path;
  if (dataItemArray !== null) {
    R.find((k) => {
      if ((k.$.name === dataItemName) || (k.$.id === dataItemName)) {
        path = k.path;
      }
    }, dataItemArray);
  }
  return path;
}


/**
  * getId() get the Id for the dataitem from the deviceSchema
  *
  * @param {String} uuid
  * @param {String} dataItemName
  *
  * return id (Eg:'dtop_2')
  */
function getId(uuid, dataItemName) {
  let id = undefined;
  const dataItemArray = getDataItem(uuid);
  if (dataItemArray !== null) {
    R.find((k) => {
      if (k.$.name === dataItemName) {
        id = k.$.id;
      }
      return (id !== undefined);
    }, dataItemArray);
  } else {
    log.debug('error in getId')
  }
  return id;
}


/**
  * searchId() get the Id for the dataitem from the deviceSchema
  *
  * @param {String} uuid
  * @param {String} dataItemName
  *
  * return id (Eg:'dtop_2')
  */
function searchId(uuid, dataItemName) {
  let id;
  const dataItemArray = getDataItem(uuid);
  if (dataItemArray !== null) {
    R.find((k) => {
      if (k.$.id === dataItemName) {
        id = k.$.id;
      }
      return (id !== undefined);
    }, dataItemArray);
  } else {
    log.debug('Error in searchId')
  }
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
  const id = obj.id;
  dataStorage.updateCircularBuffer(obj);
  dataStorage.hashCurrent.set(id, obj); // updating hashCurrent
});

/**
  * dataCollectionUpdate() inserts the shdr data into the shdr collection
  *
  * @param {Object} shdrarg - with dataitem and time
  *
  */
function dataCollectionUpdate(shdrarg, uuid) {
  const dataitemno = shdrarg.dataitem.length;
  for (let i = 0; i < dataitemno; i++) {
    const dataItemName = shdrarg.dataitem[i].name;
    const obj = { sequenceId: sequenceId++,
            uuid, time: shdrarg.time,
            value: shdrarg.dataitem[i].value };
    let id = getId(uuid, dataItemName);
    if (id !== undefined) {
      obj.dataItemName = dataItemName;
    } else {
      id = searchId(uuid, dataItemName);
    }
    obj.id = id;
    const path = getPath(uuid, dataItemName);
    obj.path = path;
    rawData.insert(obj);
  }
  return;
}

/**
  * probeResponse() create json as a response to probe request
  *
  * @param {Object} latestSchema - latest device schema
  *
  * returns the JSON object with device detail.
  */

function probeResponse(latestSchema) {
  const newXMLns = latestSchema[0].xmlns;
  const newTime = moment.utc().format();
  const dvcHeader = latestSchema[0].device.$;
  const dvcDescription = latestSchema[0].device.Description;
  const dataItems = latestSchema[0].device.DataItems;
  const components = latestSchema[0].device.Components;
  const instanceId = 0;
  let dataItem; // TODO Update the value

  let newJSON = {};
  const Device = { $:
    { name: dvcHeader.name, uuid: dvcHeader.uuid, id: dvcHeader.id },
      Description: dvcDescription,
    };

  if (dataItems !== undefined) {
    for (let j = 0; j < dataItems.length; j++) {
      dataItem = dataItems[j].DataItem;
    }
    Device.DataItems = [{ dataItem }];
  }

  if (components !== undefined) {
    Device.Components = components;
  }

  newJSON = { MTConnectDevices: { $: newXMLns,
  Header: [{ $:
  { creationTime: newTime, assetBufferSize: '1024', sender: 'localhost', assetCount: '0',
  version: '1.3', instanceId, bufferSize: '524288' } }],
  Devices: [{ Device }] } };

  return newJSON;
}

// Exports

module.exports = {
  compareSchema,
  dataCollectionUpdate,
  getDataItem,
  getRawDataDB,
  getSchemaDB,
  getId,
  getPath,
  insertSchemaToDB,
  probeResponse,
  searchDeviceSchema,
  updateSchemaCollection,
};
