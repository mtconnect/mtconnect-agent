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
const dataStorage = require('../src/dataStorage');
const lokijs = require('../src/lokijs');
const jsonToXML = require('../src/jsonToXML');
const ioEntries = require('./support/ioEntries');
const inputJSON = require('./support/sampleJSONOutput');


// constants
const cbPtr = dataStorage.circularBuffer;
const schemaPtr = lokijs.getSchemaDB();
const shdr = lokijs.getRawDataDB();
const dataItemVar = { Event:
                       [ { Availability:
                            { '$':
                               { dataItemId: 'dtop_2',
                                 sequence: 0,
                                 timestamp: '2015-02-11T12:12:57Z',
                                 name: 'avail' },
                              _: 'UNAVAILABLE' } },
                         { EmergencyStop:
                            { '$':
                               { dataItemId: 'dtop_3',
                                 sequence: 1,
                                 timestamp: '2015-02-11T12:12:57Z',
                                 name: 'estop' },
                              _: 'UNAVAILABLE' } } ],
                      Sample: [],
                      Condition: [] };

// updateJSON()

describe('updateJSON()', () => {
  describe('creates a JSON with', () => {
    it('latest schema and dataitem values', () => {
      cbPtr.empty();
      shdr.clear();
      schemaPtr.clear();
      shdr.insert({ sequenceId: 0, id: 'avail', uuid: '000', time: '2',
                   value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 1, id:'estop', uuid: '000', time: '2',
                   value: 'TRIGGERED' });
      const jsonObj = ioEntries.newJSON;
      const resultJSON = jsonToXML.updateJSON(ioEntries.schema, dataItemVar);
      expect(resultJSON.MTConnectStreams.$).to.eql(jsonObj.MTConnectStreams.$);
      expect(resultJSON.MTConnectStreams.Streams).to.eql(jsonObj.MTConnectStreams.Streams);
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
    const res = {
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
