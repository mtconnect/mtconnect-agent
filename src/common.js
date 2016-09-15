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
const dom = require('xmldom').DOMParser;
const fs = require('fs');
const path = require('path');
const xsd = require('libxml-xsd');

// Imports - Internal

const log = require('./config/logger');

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
  * getUuid() returns the UUID
  *
  * @param  null
  *
  */
function getUuid() {
  const uuid = '000'; // TODO: insert the corresponding uuid
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

function getMTConnectVersion(xmlString) {
  var version = '';

  try {
    var doc = new dom().parseFromString(xmlString);
    var node = xpath.select("//*[local-name(.)='MTConnectDevices']", doc)[0];
    var ns = node.namespaceURI;
    version = ns.split(':').pop();
  } catch (e) {
    log.error('Error: obtaining MTConnect XML namespace', e);
    return null;
  }

  return version;
}

function MTConnectValidate(documentString) {
  var schemaString = '';
  var version = getMTConnectVersion(documentString);
  if (version) {
    var schemaPath = '../schema/MTConnectDevices_' + version + '.xsd'
    var schemaFile =  path.join(__dirname, schemaPath);

    try {
      schemaString = fs.readFileSync(schemaFile, "utf8");
    } catch (e) {
      console.log('Error reading file:', '/tmp/MTConnectDevices_1.1.xsd');
      return false;
    }

    var schema = xsd.parse(schemaString);

    var validationErrors = schema.validate(documentString);
    if (validationErrors) { console.log('Error in validation: ', validationErrors); return false; } else { return true; }
  } else {
    return false;
  }
}

// Exports

module.exports = {
  getUuid,
  inputParsing,
  processError,
  getAllDeviceUuids,
  getMTConnectVersion,
  MTConnectValidate,
};
