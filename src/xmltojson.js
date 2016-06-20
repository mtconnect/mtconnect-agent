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
const xml2js = require('xml2js');

// Imports - Internal
const common = require('./common');
const loki = require('./lokijs');

// Constants
const mtcDevices = loki.getSchemaDB();

/**
  * xml device schema to json conversion
  * @param {object} XMLObj
  * returns JSON object
  */
function convertToJSON(XMLObj) { //TODO: change to xmlToJSON
  let JSONObj;
  const parser = new xml2js.Parser({ attrkey: '$' });

  // XML to JSON
  parser.parseString(XMLObj, (err, result) => {
    JSONObj = result;
  });
  return JSONObj;
}

/**
  * read objects from json and insert into collection
  * @param {Object} parsedData (JSONObj)
  * return mtcDevices (ptr to db)
  */
function insertSchemaToDB(parsedData) {
  const parsedDevice = parsedData.MTConnectDevices;
  const devices0 = parsedDevice.Devices[0];
  const xmlns = parsedDevice.$;
  const timeVal = parsedDevice.Header[0].$.creationTime;
  const numberOfDevices = parsedDevice.Devices.length;
  const numberOfDevice = devices0.Device.length;
  const uuid = [];
  const device = [];
  const name = [];

  const devicesArr = common.fillArray(numberOfDevices);
  const deviceArr = common.fillArray(numberOfDevice);
  devicesArr.map(() => {
    deviceArr.map((i) => {
      device[i] = devices0.Device[i];
      name[i] = device[i].$.name;
      uuid[i] = device[i].$.uuid;
      mtcDevices.insert({ xmlns, time: timeVal, name: name[i],
      uuid: uuid[i], device: device[i] });
      return true; // to make eslint happy
    });
    return true; // to make eslint happy
  });

  return mtcDevices;
}

// Exports

module.exports = {
  convertToJSON,
  insertSchemaToDB,
};
