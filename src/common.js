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

const xpath = require('xpath');
const Dom = require('xmldom').DOMParser;
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const tmp = require('tmp');
const defaultShell = require('child_process');
const R = require('ramda');

// Imports - Internal

const log = require('./config/logger');
const lokijs = require('./lokijs');
const dataStorage = require('./dataStorage');
const devices = require('./store');

// Functions
function getType (name, uuid) {
  const dataItem = lokijs.getDataItem(uuid, name);
  if (dataItem) {
    return dataItem.$.type;
  }
  return undefined;
}

function checkForTimeSeries (name, uuid) {
  const dataItem = lokijs.getDataItem(uuid, name);
  let isTimeSeries = false;
  if (dataItem && dataItem.$.representation === 'TIME_SERIES') {
    isTimeSeries = true;
  }
  return isTimeSeries;
}

function getCategory (name, uuid) {
  const dataItem = lokijs.getDataItem(uuid, name);
  if (dataItem) {
    return dataItem.$.category;
  }
  return undefined;
}

function parseCalibration(inputString, uuid) {
  let dataItem;
  const fields = inputString.split('|');
  for (let i = 0, len = fields.length; i < len; i += 3) {
    dataItem = lokijs.getDataItem(uuid, fields[i]);
    if (dataItem) {
      dataItem.ConversionFactor = fields[i + 1];
      dataItem.ConversionOffset = fields[i + 2];
    }
  }
}

function setManufacturer(inputString, uuid) {
  const device = lokijs.searchDeviceSchema(uuid)[0].device;
  const description = device.Description[0];
  description.$.manufacturer = inputString.trim();
}

function setSerialNumber(inputString, uuid) {
  const device = lokijs.searchDeviceSchema(uuid)[0].device;
  const description = device.Description[0];
  description.$.serialNumber = inputString.trim();
}

function setStation(inputString, uuid) {
  const device = lokijs.searchDeviceSchema(uuid)[0].device;
  const description = device.Description[0];
  description.$.station = inputString.trim();
}

function setUuid(inputString, uuid) {
  const device = lokijs.searchDeviceSchema(uuid)[0].device;
  const preserve = dataStorage.getConfiguredVal(device.$.name, 'PreserveUuid');
  if (!preserve) {
    const schemaDB = lokijs.getSchemaDB();
    const dev = R.find(item => item.uuid === device.$.uuid)(schemaDB.data);
    const d = R.find(item => item.uuid === device.$.uuid)(devices.data);
    dev.uuid = inputString.trim();
    d.uuid = inputString.trim();
    device.$.uuid = inputString.trim();
    lokijs.addNewUuidToPath(d.uuid);
  }
}

function setFilterDuplicates(value, uuid) {
  const device = lokijs.searchDeviceSchema(uuid)[0].device;
  const isBool = (value.trim() === 'true');
  dataStorage.setConfiguration(device, 'FilterDuplicates', isBool);
}

function setIgnoreTimestamps(value, uuid) {
  const device = lokijs.searchDeviceSchema(uuid)[0].device;
  const isBool = (value.trim() === 'true');
  dataStorage.setConfiguration(device, 'IgnoreTimestamps', isBool);
}

function setRelativeTime(value, uuid) {
  const device = lokijs.searchDeviceSchema(uuid)[0].device;
  const isBool = (value.trim() === 'true');
  dataStorage.setConfiguration(device, 'RelativeTime', isBool);
}

function setConversionRequired(value, uuid) {
  const device = lokijs.searchDeviceSchema(uuid)[0].device;
  const isBool = (value.trim() === 'true');
  dataStorage.setConfiguration(device, 'ConversionRequired', isBool)
}

function setPreserveUuid(value, uuid) {
  const device = lokijs.searchDeviceSchema(uuid)[0].device;
  const isBool = (value.trim() === 'true');
  dataStorage.setConfiguration(device, 'PreserveUuid', isBool);
}

function setAutoAvailable(value, uuid) {
  const device = lokijs.searchDeviceSchema(uuid)[0].device;
  const isBool = (value.trim() === 'true');
  dataStorage.setConfiguration(device, 'AutoAvailable', isBool);
}

function setDescription(value, uuid) {
  const device = lokijs.searchDeviceSchema(uuid)[0].device;
  device.Description[0]._ = value.trim()
}

function protocolCommand(inputString, uuid) {
  let command;
  let value;
  const fields = inputString.split(':');

  if (fields.length > 2) {
    multiDeviceCommands(inputString)
  } else {
    command = fields[0].substr(2);
    value = fields[1];
  }

  // const command = inputParsing[0].substr(2)
  if (command === 'calibration') {
    parseCalibration(value, uuid)
  }

  if (command === 'manufacturer') {
    setManufacturer(value, uuid)
  }

  if (command === 'serialNumber') {
    setSerialNumber(value, uuid)
  }

  if (command === 'description') {
    setDescription(value, uuid)
  }

  if (command === 'station') {
    setStation(value, uuid)
  }

  if (command === 'uuid') {
    setUuid(value, uuid)
  }

  if (command === 'filterDuplicates') {
    setFilterDuplicates(value, uuid)
  }

  if (command === 'ignoreTimestamps') {
    setIgnoreTimestamps(value, uuid)
  }

  if (command === 'relativeTime') {
    setRelativeTime(value, uuid)
  }

  if (command === 'conversionRequired') {
    setConversionRequired(value, uuid)
  }

  if (command === 'preserveUuid') {
    setPreserveUuid(value, uuid)
  }

  if (command === 'autoAvailable') {
    setAutoAvailable(value, uuid)
  }
}

function multiDeviceCommands(inputString) {
  const arr = inputString.split('|');
  const len = arr.length;
  let i = 0, command, deviceName, uuid, value = [], splited = [];
  while (i < len) {
    if (arr[i].includes(':')) {
      splited = arr[i].split(':');
      deviceName = (splited[0][0] === '*') ? splited[0].substr(2) : splited[0];
      uuid = getDeviceUuid(deviceName);
      command = splited[1];
      value.push(splited[2]);
      i++
    }

    if (command === 'manufacturer') {
      setManufacturer(value.pop(), uuid)
    }

    if (command === 'serialNumber') {
      setSerialNumber(value.pop(), uuid)
    }

    if (command === 'station') {
      setStation(value.pop(), uuid)
    }

    if (command === 'description') {
      setDescription(value.pop(), uuid)
    }

    if (command === 'conversionRequired') {
      setConversionRequired(value.pop(), uuid)
    }

    if (command === 'relativeTime') {
      setRelativeTime(value.pop(), uuid)
    }

    if (command === 'autoAvailable') {
      setAutoAvailable(value.pop(), uuid)
    }

    if (command === 'calibration') {
      while (i < len && !arr[i].includes(':')) {
        value.push(arr[i]);
        i++
      }
      parseCalibration(value.join('|'), uuid);
      value = []
    }
  }
}

function multiDeviceParsing(inputParse) {
  const time = inputParse.shift();
  const len = inputParse.length;
  let i = 0, uuid, dataItemName, items = [];
  while (i < len) {
    if (inputParse[i].includes(':')) {
      [deviceName, dataItemName] = inputParse[i].split(':');
      items.push(time, dataItemName);
      uuid = getDeviceUuid(deviceName);
      i++
    } else {
      while (i < len && !inputParse[i].includes(':')) {
        items.push(inputParse[i]);
        i++
      }

      const parsed = inputParsing(items, uuid);
      lokijs.dataCollectionUpdate(parsed, uuid);
      items = []
    }
  }
}

/**
  * inputParsing get the data from adapter, do string parsing
  * @param {String} inputParse
  * @param {String} uuid
  * returns jsonData with time and dataitem
  */
function inputParsing (inputParse, uuid) {
 // ('2014-08-11T08:32:54.028533Z|avail|AVAILABLE')

  const jsonData = {
    time: inputParse[0],
    dataitem: [],
  };

  if (jsonData.time === '') {
    jsonData.time = moment.utc().format()
  }

  const dataItemId = inputParse[1];
  if (inputParse[1] === '@ASSET@' || inputParse[1] === '@UPDATE_ASSET@' ||
      inputParse[1] === '@REMOVE_ASSET@' || inputParse[1] === '@REMOVE_ALL_ASSETS@') {
    const value = inputParse.slice(2, Infinity);
    jsonData.dataitem.push({ name: inputParse[1], value });
    return jsonData
  }
  const category = getCategory(dataItemId, uuid);
  const isTimeSeries = checkForTimeSeries(dataItemId, uuid);
  const type = getType(dataItemId, uuid);
  if (category === 'CONDITION') {
    const value = inputParse.slice(2, Infinity);
    jsonData.dataitem.push({ name: inputParse[1], value })
  } else if (type === 'MESSAGE' || type === 'ALARM') {
    const value = inputParse.slice(2, Infinity);
    jsonData.dataitem.push({ name: inputParse[1], value })
  } else if (isTimeSeries) {
    // Eg: { time: '2',  dataitem: [ { name: 'Va', value:[ SampleCount, SampleRate, 'value1 valu2 ...'] }] }
    const value = inputParse.slice(2, Infinity);
    jsonData.dataitem.push({ name: inputParse[1], value, isTimeSeries: true })
  } else {
    const totalDataItem = (inputParse.length - 1) / 2;
    for (let i = 0, j = 1; i < totalDataItem; i++, j += 2) {
      //  Eg: dataitem[i] = { name: (avail), value: (AVAILABLE) };
      jsonData.dataitem.push({ name: inputParse[j], value: inputParse[j + 1] })
    }
  }
  return jsonData
}

/**
  * getAllDeviceUuids() returns the UUID
  *
  * @param {Object} devices - database of devices connected
  * return uuidSet - array containing all uuids.
  */
// function getAllDeviceUuids (devices) {
//   return R.map(device => device.uuid, devices.data)
// }

function getAllDeviceUuids() {
  const schemaDb = lokijs.getSchemaDB();
  const uuids = [];
  R.map((schema) => {
    uuids.push(schema.uuid);
    return uuids
  }, schemaDb.data);
  return uuids
}

/**
  * isDeviceUuid(uuid) returns true if UUID exists
  *
  * @param {uuid} UUID - UUID to check
  * return uuidSet - array containing all uuids.
  */

function isDeviceUuid(uuid) {
  const schemaDb = lokijs.getSchemaDB();
  const schemaList = R.values(schemaDB.data);
  R.find((k) => {
    if (k.uuid === uuid) {
      return true;
    }
  }, schemaList);
  return false;
}
/**
  * duplicateUuidCheck() checks the device collection for
  * received uuid
  * @param {String} receivedUuid - uuid of new device
  * @param {Object} devices - database
  * return uuidFound - array of entries with same uuid
  */
function duplicateUuidCheck (receivedUuid, devices) {
  return devices.find({ uuid: receivedUuid })
}

/**
  * getDeviceUuid() returns the UUID of the device for the deviceName
  *  @param  {String} deviceName
  *  return uuid
  */
function getDeviceUuid (deviceName) {
  const schemaDB = lokijs.getSchemaDB();
  const schemaList = R.values(schemaDB.data);
  let uuid;
  R.find((k) => {
    if (k.name === deviceName) {
      uuid = k.uuid
    }
    return uuid
  }, schemaList);
  return uuid
}

/**
  * getCurrentTimeInSec()
  * returns the present time in Sec
  */
function getCurrentTimeInSec () {
  return moment().unix(Number)
}

/**
  * processError() logs an error message
  * and exits with status code 1.
  *
  * @param {String} message
  * @param {Boolean} exit
  */
function processError (message, exit) {
  log.error(`Error: ${message}`);

  if (exit) process.exit(1)
}

function getMTConnectVersion (xmlString) {
  let version = '';

  try {
    const doc = new Dom().parseFromString(xmlString);
    const node = xpath.select("//*[local-name(.)='MTConnectDevices']", doc)[0];
    const ns = node.namespaceURI;
    version = ns.split(':').pop()
  } catch (e) {
    log.error('Error: obtaining MTConnect XML namespace', e);
    return null
  }

  return version
}

function mtConnectValidate (documentString) {
  const version = getMTConnectVersion(documentString);
  const deviceXMLFile = tmp.tmpNameSync();

  try {
    fs.writeFileSync(deviceXMLFile, documentString, 'utf8')
  } catch (err) {
    log.error('Cannot write documentString to deviceXML file', err);
    return false
  }

  if (version) {
    const schemaPath = `../schema/MTConnectDevices_${version}.xsd`;
    const schemaFile = path.join(__dirname, schemaPath);
    // candidate for validation worker
    const child = defaultShell.spawnSync('xmllint', ['--valid', '--schema', schemaFile, deviceXMLFile]);
    fs.unlinkSync(deviceXMLFile);

    if (child.stderr) {
      if (child.stderr.includes('fails to validate') ||
       child.stderr.includes('failed to load external entity')) {
        console.log(child.stderr.toString());
        log.error('Not valid xml');
        return false
      }
    }
    return true
  }
  return false
}

function parsing(inputString, uuid) {
  if (inputString[0] === '*') {
    protocolCommand(inputString, uuid);
    return;
  }
  
  const inputParse = inputString.split('|');
  
  if (inputParse[1].includes(':')) {
    multiDeviceParsing(inputParse);
  } else {
    const parsed = inputParsing(inputParse, uuid);
    lokijs.dataCollectionUpdate(parsed, uuid)
  }
}

// Exports

module.exports = {
  getDeviceUuid,
  parsing,
  inputParsing,
  processError,
  getAllDeviceUuids,
  getCurrentTimeInSec,
  getMTConnectVersion,
  mtConnectValidate,
  duplicateUuidCheck,
  protocolCommand,
};
