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
const xsd = require('libxml-xsd');
const moment = require('moment');

// Imports - Internal

const log = require('./config/logger');
const lokijs = require('./lokijs');
const dataStorage = require('./dataStorage');
const R = require('ramda');

// Functions

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


function getAllDeviceUuids(devices) {
  const setOfDevice = devices.data;
  const uuidSet = [];
  for (let i = 0; i < setOfDevice.length; i++) {
    uuidSet[i] = setOfDevice[i].uuid;
  }
  return uuidSet;
}


/**
  * getDeviceUuid() returns the UUID
  *
  * @param  null
  *
  */
function getDeviceUuid(deviceName) {
  const schemaDB = lokijs.getSchemaDB();
  const schemaList = R.values(schemaDB.data);
  let uuid;
  R.find((k) => {
    if (k.name === deviceName) {
      uuid = k.uuid;
    }
    return uuid;
  }, schemaList);
  return uuid;
}

/**
  * getCurrentTimeInSec()
  * returns the present time in Sec
  */
function getCurrentTimeInSec(){
  return moment().unix(Number);
}

/**
  * processError() logs an error message
  * and exits with status code 1.
  *
  * @param {String} message
  * @param {Boolean} exit
  */
function processError(message, exit) {
  log.error(`Error: ${message}`);

  if (exit) process.exit(1);
}

function getMTConnectVersion(xmlString) {
  let version = '';

  try {
    const doc = new Dom().parseFromString(xmlString);
    const node = xpath.select("//*[local-name(.)='MTConnectDevices']", doc)[0];
    const ns = node.namespaceURI;
    version = ns.split(':').pop();
  } catch (e) {
    log.error('Error: obtaining MTConnect XML namespace', e);
    return null;
  }

  return version;
}

function mtConnectValidate(documentString) {
  let schemaString = '';
  const version = getMTConnectVersion(documentString);
  if (version) {
    const schemaPath = `../schema/MTConnectDevices_${version}.xsd`;
    const schemaFile = path.join(__dirname, schemaPath);

    try {
      schemaString = fs.readFileSync(schemaFile, 'utf8');
    } catch (e) {
      console.log('Error reading file:', '/tmp/MTConnectDevices_1.1.xsd');
      return false;
    }

    const schema = xsd.parse(schemaString);

    const validationErrors = schema.validate(documentString);
    if (validationErrors) {
      console.log('Error in validation: ', validationErrors);
      return false;
    }
    return true;
  }
  return false;
}

function getPathArr(uuidCollection) {
  let pathArr = [];
  let obj = {};
  let i = 0;
  R.map((k) => {
    const dataItemsArr = lokijs.getDataItem(k);

    //create pathArr for all dataItems
    if (dataItemsArr.length !== 0) {
      for (let j = 0; j < dataItemsArr.length; j++) {
        pathArr[i++] = dataItemsArr[j].path;
      }
    }
  }, uuidCollection);
  return pathArr;
}

function pathValidation (recPath, uuidCollection) {
  let pathArr = getPathArr(uuidCollection);
  let result = dataStorage.filterPathArr(pathArr, recPath);
  if (result.length !== 0) {
    return true;
  }
  return false;
}
// Exports

module.exports = {
  getDeviceUuid,
  inputParsing,
  processError,
  getAllDeviceUuids,
  getCurrentTimeInSec,
  getMTConnectVersion,
  mtConnectValidate,
  pathValidation,
};
