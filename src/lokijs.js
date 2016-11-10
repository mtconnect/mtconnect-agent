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
const R = require('ramda');
const moment = require('moment');
const sha1 = require('sha1');

// Imports - Internal

const dataStorage = require('./dataStorage');
const xmlToJSON = require('./xmlToJSON');
const log = require('./config/logger');

// Instances

const Db = new Loki('loki.json');

// Constants - datacollection pointers

const rawData = Db.addCollection('rawData');
const mtcDevices = Db.addCollection('DeviceDefinition');
const assetCollection = [];

// variables

let sequenceId = 1; // sequenceId starts from 1.
let dataItemsArr = [];
let d = 0;

/* ********************** support functions *************************** */

function insertRawData(obj) { // TODO in future we should support moving window
  if (rawData.maxId >= 1000) {
    rawData.clear();
    rawData.insert(obj);
  } else {
    rawData.insert(obj);
  }
  return;
}

/**
  * initiateCircularBuffer() inserts default value for each dataitem (from the schema)
  * in to the database which in turn updates circular buffer, hashCurrent and hashLast.
  *
  * @param = {object} dataitem: Array of all dataItem for each devices in  schema
  * @param = {String} time: time from deviceSchema
  * @param = {String} uuid: UUID from deviceSchema
  */

function initiateCircularBuffer(dataItem, time, uuid, isDisconnect) {
  R.map((k) => {
    const dataItemName = k.$.name;
    const id = k.$.id;
    const type = k.$.type;
    const path = k.path;
    const constraint = k.Constraints;
    const obj = { sequenceId: sequenceId++, id, uuid, time, path };

    if (dataItemName !== undefined) {
      obj.dataItemName = dataItemName;
    }
    if (constraint !== undefined) {
      obj.value = constraint[0].Value[0];
    } else if (type === 'AVAILABILITY' && !isDisconnect) {
      obj.value = 'AVAILABLE';
    } else {
      obj.value = 'UNAVAILABLE';
    }
    insertRawData(obj);
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
        let path3 = `${path}//DataItem`;
        if (dataItem[j].$.type) {
          const typeVal = dataItem[j].$.type;
          if (dataItem[j].$.subType) {
            const subTypeVal = dataItem[j].$.subType;
            path3 = `${path3}[@type=\"${typeVal}\" and @subType=\"${subTypeVal}\"]`;
          } else {
            path3 = `${path3}[@type=\"${typeVal}\"]`;
          }
        }
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
        const path1 = `${path}//Axes`;
        levelFiveParse(components[i].Axes, path1);
      }
      if (components[i].Controller !== undefined) {
        const path2 = `${path}//Controller`;
        levelFiveParse(components[i].Controller, path2);
      }
      if (components[i].Systems !== undefined) {
        const path3 = `${path}//Systems`;
        levelFiveParse(components[i].Systems, path3);
      }
    }
  }
  return dataItemsArr;
}

function addEvents(uuid, availId, assetChangedId, assetRemovedId) {
  const findUuid = searchDeviceSchema(uuid);
  const device = findUuid[findUuid.length - 1].device;
  const deviceId = device.$.id;
  const dataItems = device.DataItems;
  const dataItem = dataItems[dataItems.length - 1].DataItem;

  if (!availId) {
    const obj = { $: { category: 'EVENT', id: 'avail', type: 'AVAILABILITY' } };
    dataItem.push(obj);
    log.debug(`Cannot find \'availability\' for ${uuid}`);
  }

  if (!assetChangedId) {
    const obj = { $: { category: 'EVENT', id: `${deviceId}_asset_chg`, type: 'ASSET_CHANGED' } };
    dataItem.push(obj);
  }

  if (!assetRemovedId) {
    const obj = { $: { category: 'EVENT', id: `${deviceId}_asset_rem`, type: 'ASSET_REMOVED' } };
    dataItem.push(obj);
  }
}


// TODO: call function to check AVAILABILITY,
// if present change all AVAILABILITY event value to AVAILABLE.
// Check AVAILABILTY, ASSET_CHANGED, ASSET_REMOVED events
function checkForEvents(uuid) {
  const dataItemSet = getDataItem(uuid);

  let assetChangedId;
  let assetRemovedId;
  let availId;
  if (!R.isEmpty(dataItemSet) || (dataItemSet !== null)) {
    R.map((k) => {
      const type = k.$.type;
      if (type === 'AVAILABILITY') {
        availId = k.$.id;
      } else if (type === 'ASSET_CHANGED') {
        assetChangedId = k.$.id;
      } else if (type === 'ASSET_REMOVED') {
        assetRemovedId = k.$.id;
      }
      return type; // eslint
    }, dataItemSet);
    addEvents(uuid, availId, assetChangedId, assetRemovedId);
  }
}


/**
  * read objects from json and insert into collection
  * @param {Object} parsedData (JSONObj)
  *
  */
function insertSchemaToDB(parsedData, sha) {
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
      uuid: uuid[j], device: device[j], sha });
      checkForEvents(uuid[j]);
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
function updateSchemaCollection(schemaReceived) { // TODO check duplicate first.
  const xmlSha = sha1(schemaReceived);
  const jsonObj = xmlToJSON.xmlToJSON(schemaReceived);
  if (jsonObj !== undefined) {
    const uuid = jsonObj.MTConnectDevices.Devices[0].Device[0].$.uuid;
    const xmlSchema = getSchemaDB();
    const checkUuid = xmlSchema.chain()
                               .find({ uuid })
                               .data();
    if (!checkUuid.length) {
      log.debug('Adding a new device schema');
      insertSchemaToDB(jsonObj, xmlSha);
    } else if (xmlSha === checkUuid[0].sha) {
      log.debug('This device schema already exist');
    } else {
      log.debug('Adding updated device schema');
      insertSchemaToDB(jsonObj, xmlSha);
    }
  } else {
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
      return path; // eslint
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
    log.debug('error in getId');
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
    log.debug('Error in searchId');
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


/* ****************************************Asset********************************* */
function createAssetCollection(assetId) {
  let assetPresent = false;
  if (assetCollection.length === 0) {
    assetCollection.push(assetId);
    return;
  }
  R.find((k) => {
    if (k === assetId) {
      assetPresent = true;
    }
    return assetPresent;
  }, assetCollection);
  if (!assetPresent) {
    assetCollection.push(assetId);
  }
  return;
}

function findKey(asset, object, key) {
  if (object.hasOwnProperty(key)) {
    return asset;
  }
  let keys = Object.keys(object);
  for (let i = 0; i < keys.length; i++) {
    if (typeof object[keys[i]] == 'object') {
      const o = findKey( asset[keys[i]], object[Object.keys(object)[i]], key, count);
      if (o != null) {
        return o;
      }
    }
  }
}


function updateAsset(assetToUpdate, time, dataItemSet) {
  let foundKey;
  let foundVal;
  R.map((k) => {
    const key = k.name;
    foundKey = findKey(assetToUpdate.value, assetToUpdate.value, key);
    foundKey[k.name][0]._ = k.value;
  }, dataItemSet);
  return assetToUpdate;
}


function updateAssetCollection(shdrarg, uuid) { // args: shdrarg, uuid
  const assetItem = shdrarg.dataitem[0];
  const time = shdrarg.time;
  const dataItemName = assetItem.name;
  const assetId = assetItem.value;
  if (dataItemName === '@UPDATE_ASSET@') {
    const dataItemSet = shdrarg.dataitem.slice(1, Infinity);
    const assetPresent = dataStorage.hashAssetCurrent.get(assetId);
    if (assetPresent === undefined) {
      return console.log('Error Asset not Present');
    }
    const assetToUpdate = R.clone(assetPresent);
    const newVal = updateAsset(assetToUpdate, time, dataItemSet);
    newVal.time = time;
    dataStorage.hashAssetCurrent.set(assetId, newVal);
    dataStorage.assetBuffer.push(newVal);
  }
  if (dataItemName === '@REMOVE_ASSET@') {
    removedAsset = dataStorage.hashAssetCurrent.get(assetId);
    removedAsset.removed = true;
  }
}


function getDeviceName(uuid) {
  const schemaDB = getSchemaDB();
  const schemaList = R.values(schemaDB.data);
  let deviceName;
  R.find((k) => {
    if (k.uuid === uuid) {
      deviceName = k.name;
    }
    return deviceName; // eslint
  }, schemaList);
  return deviceName;
}

function addToAssetCollection(shdrarg, uuid) {
  console.log(require('util').inspect(shdrarg, { depth: null }));
  const assetItem = shdrarg.dataitem[0];
  const time = shdrarg.time;
  const assetId = assetItem.value[0];
  const assetType = assetItem.value[1];
  const value = xmlToJSON.xmlToJSON(assetItem.value[2]);
  const target = getDeviceName(uuid);
  const obj = {
    time,
    assetId,
    uuid: uuid,
    target,
    assetType,
    removed: false,
    value,
  };
  dataStorage.assetBuffer.push(obj);
  dataStorage.hashAssetCurrent.set(assetId, obj);
  createAssetCollection(assetId);
  return;
}


function getAssetCollection() {
  return assetCollection;
}


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
    if (dataItemName === '@ASSET@') {
      return addToAssetCollection(shdrarg, uuid);
    } else if (dataItemName === '@UPDATE_ASSET@' || dataItemName === '@REMOVE_ASSET@') {
      return updateAssetCollection(shdrarg, uuid);
    }
    const obj = { sequenceId: undefined,
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
    if (!dataStorage.hashCurrent.has(id)) {
      obj.sequenceId = sequenceId++;
      insertRawData(obj);
    } else {
      const dataItem = dataStorage.hashCurrent.get(id);
      const previousValue = dataItem.value;
      if (Array.isArray(previousValue) && (previousValue[0] === 'NORMAL') && (previousValue[0] === obj.value[0])) {
        return log.debug('duplicate NORMAL Condition');
      } else if ((previousValue === obj.value) && !Array.isArray(previousValue)) {
        return log.debug('Duplicate entry'); // eslint
      }
      obj.sequenceId = sequenceId++;
      insertRawData(obj);
    }
  }
  return log.debug('updatedDataCollection');  // eslint
}


// To initiate the CB, hashCurrent and hashLast on disconnect
function updateBufferOnDisconnect(uuid) {
  const dataItem = getDataItem(uuid);
  const time = moment.utc().format();
  initiateCircularBuffer(dataItem, time, uuid, 1);
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
  const Device = [{ $:
    { name: dvcHeader.name, uuid: dvcHeader.uuid },
      Description: dvcDescription,
    }];

  if (dataItems !== undefined) {
    for (let j = 0; j < dataItems.length; j++) {
      dataItem = dataItems[j].DataItem;
    }
    Device[0].DataItems = [{ dataItem }];
  }

  if (components !== undefined) {
    Device[0].Components = components;
  }

  newJSON = { MTConnectDevices: { $: newXMLns,
  Header: [{ $:
  { creationTime: newTime, assetBufferSize: '1024', sender: 'localhost', assetCount: '0',
  version: '1.3', instanceId, bufferSize: '524288' } }],
  Devices: [{ Device }] } };

  return newJSON;
}


/**
  * getPathArr creates an array of path parameter for given device collection
  * @param {String} uuidCollection : array of uuid of active devices.
  * returns pathArr: array of path
  */
function getPathArr(uuidCollection) {
  const pathArr = [];
  let i = 0;
  R.map((k) => {
    const dataItemsSet = getDataItem(k);

    // create pathArr for all dataItems
    if (dataItemsSet.length !== 0) {
      for (let j = 0; j < dataItemsSet.length; j++) {
        pathArr[i++] = dataItemsSet[j].path;
      }
    }
    return pathArr; // eslint
  }, uuidCollection);
  return pathArr;
}

/**
  * pathValidation() checks whether the received path is a valid XPATH
  * @param recPath - eg: //Axes//Rotary
  * @param uuidCollection - array of uuid of active devices.
  * return true - if path Valid, false - invalid path.
  */
function pathValidation(recPath, uuidCollection) {
  const pathArr = getPathArr(uuidCollection);
  const result = dataStorage.filterPathArr(pathArr, recPath);
  if (result.length !== 0) {
    return true;
  }
  return false;
}
// Exports

module.exports = {
  compareSchema,
  checkForEvents,
  dataCollectionUpdate,
  getDataItem,
  getRawDataDB,
  getSchemaDB,
  getId,
  getPath,
  getAssetCollection,
  insertSchemaToDB,
  probeResponse,
  pathValidation,
  searchDeviceSchema,
  updateSchemaCollection,
  updateBufferOnDisconnect,
  insertRawData,
};
