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

// Imports - Internal

const xmlToJSON = require('../src/xmlToJSON');
const expectedJSON = require('./support/sampleJSONOutput');

// constants

const xml1 = fs.readFileSync('./test/support/output.xml', 'utf8');
// test - xmlToJSON()

describe('xmlToJSON()', () => {
  it('converts XML to JSON', () => {
    const check1 = xmlToJSON.xmlToJSON(xml1);
    expect(check1).to.eql(expectedJSON);
  });
});
