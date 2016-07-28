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

const expect = require('expect.js');
const fs = require('fs');
const R = require('ramda');

// Imports - Internal

const ioEntries = require('./support/ioEntries');
const dataStorage = require('../src/dataStorage');
const lokijs = require('../src/lokijs');
const parseDataItem = require('../src/parseDataItem');
const sameJSON = require('./support/sampleJSONOutput');
const differentJSON = require('./support/sampleJSONEdited');

// constants
const schemaPtr = lokijs.getSchemaDB();
const rawData = lokijs.getRawDataDB();
const uuid = '000';


describe.only('getDataItems()', () => {
  describe('get all the DataItems ', () => {
    it('in the schema', () => {
      schemaPtr.removeDataOnly();
      const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
      lokijs.insertSchemaToDB(JSON.parse(jsonFile));
      parseDataItem.getDataItems('000');

    });
  });
});
