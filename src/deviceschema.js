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
const xmltojson = require('./xmltojson'); // TODO change name of the file

/**
  * compareSchema() checks for duplicate entry
  * @param {object} foundfromdc - existing entry with same uuid.
  * @param {object} newobj - received schema in JSON
  * returns true if the existing schema is same as the new schema
  */
function compareSchema(foundfromdc, newobj) {
  const dcheader = foundfromdc[0].xmlns;
  const dctime = foundfromdc[0].time;
  const dcdevice = foundfromdc[0].device;
  const newheader = newobj.MTConnectDevices.$;
  const newtime = newobj.MTConnectDevices.Header[0].$.creationTime;
  const newdevice = newobj.MTConnectDevices.Devices[0].Device[0];

  if (R.equals(dcheader, newheader)) {
    if (R.equals(dctime, newtime)) {
      if (R.equals(dcdevice, newdevice)) {
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
  const jsonobj = xmltojson.convertToJSON(schemareceived);
  const uuid = jsonobj.MTConnectDevices.Devices[0].Device[0].$.uuid;
  const schemaptr = lokijs.getschemaDB();

  // Search the database for entries with same uuid
  const checkUuid = schemaptr.chain()
                             .find({ uuid })
                             .data();
  let xmlschema = schemaptr;

  if (!checkUuid.length) {
    console.log('Adding a new device schema');
    xmlschema = xmltojson.insertSchemaToDB(jsonobj);
    return xmlschema;
  } else if (compareSchema(checkUuid, jsonobj)) {
    console.log('This device schema already exist');
    return xmlschema;
  }
  console.log('Adding updated device schema');
  xmlschema = xmltojson.insertSchemaToDB(jsonobj);
  return xmlschema;
}

module.exports = {
  compareSchema,
  updateSchemaCollection,
};
