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

const R = require('ramda');

// Imports - Internal

const lokijs = require('./lokijs');
const xmlToJSON = require('./xmlToJSON'); // TODO change name of the file

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
  * @param {object} schemareceived - XML from http.get
  * returns the lokijs DB ptr
  */
function updateSchemaCollection(schemareceived) {
  const jsonObj = xmlToJSON.convertToJSON(schemareceived);
  const uuid = jsonObj.MTConnectDevices.Devices[0].Device[0].$.uuid;
  const schemaPtr = lokijs.getSchemaDB();

  // Search the database for entries with same uuid
  const checkUuid = schemaPtr.chain()
                             .find({ uuid })
                             .data();
  let xmlSchema = schemaPtr;

  if (!checkUuid.length) {
    console.log('Adding a new device schema');
    xmlSchema = xmlToJSON.insertSchemaToDB(jsonObj);
    return xmlSchema;
  } else if (compareSchema(checkUuid, jsonObj)) {
    console.log('This device schema already exist');
    return xmlSchema;
  }
  console.log('Adding updated device schema');
  xmlSchema = xmlToJSON.insertSchemaToDB(jsonObj);
  return xmlSchema;
}

module.exports = {
  compareSchema,
  updateSchemaCollection,
};
