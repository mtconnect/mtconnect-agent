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
const sinon = require('sinon');
const fs = require('fs');

// Imports - Internal

const jsonToXML = require('../src/jsonToXML');
const ioEntries = require('./support/ioEntries');
const inputJSON = require('./support/sampleJSONOutput');

// constants
const dataItemVar = [{ $:
     { type: 'AVAILABILITY',
       category: 'EVENT',
       id: 'dtop_2',
       name: 'avail' },
    _: 'AVAILABLE' }];

// updateJSON()

describe('updateJSON()', () => {
  describe('creates a JSON with', () => {
    it('latest schema and dataitem values', () => {
      const resultJSON = jsonToXML.updateJSON(ioEntries.schema, dataItemVar);
      return expect(resultJSON).to.eql(ioEntries.objJSON);
    });
  });
});

// jsonToXML()
// TODO: check how to getrid of standalone in converted xml
// TODO: restore the functions after the test or sinon.test

describe('jsonToXML()', () => {
  it('converts the json to xml', (done) => {
    let xmlString = fs.readFileSync('./test/support/output.xml', 'utf8');

    // removing the \r\n when read from file
    xmlString = xmlString.replace(/(?:\\[rn]|[\r\n]+)+/g, '\n');
    xmlString = xmlString.replace('</MTConnectDevices>\n', '</MTConnectDevices>');
    res = {
      write: sinon.stub(),
      writeHead: sinon.stub(),
      addTrailers: sinon.stub(),
    };

    res.end = () => {
      expect(res.write.firstCall.args[0]).to.eql(xmlString);
      done();
    };
    jsonToXML.jsonToXML(JSON.stringify(inputJSON), res);
  });
});
