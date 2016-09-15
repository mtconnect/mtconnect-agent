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

const log = require('./config/logger');
const lokijs = require('./lokijs');
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

// Exports

module.exports = {
  getDeviceUuid,
  inputParsing,
  processError,
  getAllDeviceUuids,
};
