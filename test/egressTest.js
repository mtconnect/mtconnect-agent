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

// Imports - Internal

const lokijs = require('../src/lokijs');
const jsonToXML = require('../src/jsonToXML');
const dataStorage = require('../src/dataStorage');
const ioentries = require('./checkfiles/ioentries');

// constants

const shdr = lokijs.getRawDataDB();
const cbPtr = dataStorage.circularBuffer;
const output1 = { dataItemName: 'avail',
  uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
  id: 'dtop_2',
  value: 'CHECK' };

const output2 = [{ $:
     { type: 'AVAILABILITY',
       category: 'EVENT',
       id: 'dtop_2',
       name: 'avail' },
    _: 'AVAILABLE' },
  { $:
     { type: 'EMERGENCY_STOP',
       category: 'EVENT',
       id: 'dtop_3',
       name: 'estop' },
    _: 'TRIGGERED' }];

const dataitemvar = [{ $:
     { type: 'AVAILABILITY',
       category: 'EVENT',
       id: 'dtop_2',
       name: 'avail' },
    _: 'AVAILABLE' }];


const idVal = 'dtop_2';
const uuidVal = 'innovaluesthailand_CINCOMA26-1_b77e26';

describe(' Check the circular buffer for the entry', () => {
  describe('readFromCircularBuffer()', () => {
    it('should give the data as it is present in circular buffer', () => {
      shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK' });
      const result = dataStorage.readFromCircularBuffer(cbPtr, idVal, uuidVal, 'avail');
      return expect(result).to.eql(output1);
    });
    it('should not give the data as it is absent in circular buffer', () => {
      const result = dataStorage.readFromCircularBuffer(cbPtr, idVal, uuidVal, 'garbage');
      return expect(result).to.eql(undefined);
    });
  });
});


describe('Check the device schema to get the recent data', () => {
  describe('searchDeviceSchema()', () => {
    it('should give the  recent device schema present in data base', () => {
      // const xml1 = fs.readFileSync('E:/connect-agent/test/checkfiles/Devices2di.xml', 'utf8');
      // deviceschema.updateSchemaCollection(xml1);
      const uuid = 'innovaluesthailand_CINCOMA26-1_b77e26';
      const schema = lokijs.searchDeviceSchema(uuid);
      const refschema = ioentries.schema[0];
      return expect(schema[0].device).to.eql(refschema.device);
    });
  });
});


describe('get the recent dataitem entry from shdr collection', () => {
  describe('getDataItem()', () => {
    it('should give the recent dataitem entry present in data base', () => {
      cbPtr.clear();
      shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 1, id: 'dtop_3', uuid: uuidVal, time: '2',
                                  dataItemName: 'estop', value: 'TRIGGERED' });
      const result = dataStorage.getDataItem(ioentries.schema, cbPtr);
      return expect(result).to.eql(output2);
    });
  });
});

// TODO: change the test, check how to getrid of standalone in converted xml
// // find a way to read the data without \r
// describe('convert the JSON to XML', () => {
//   describe('jsonToXML()', () => {
//     jsonToXML.jsonToXML(JSON.stringify(inputJSON),
//     './test/checkfiles/output.xml');
//     it('the XML should match', () => {
//       const xml1 = fs.readFileSync('./test/checkfiles/Devices2di.xml', 'utf8');
//       const result1 = fs.readFileSync('./test/checkfiles/output.xml', 'utf8');
//       console.log(require('util').inspect(xml1, { depth: null }));
//       console.log("\n **************************************8************************ \n")
//       console.log(require('util').inspect(result1, { depth: null }));
//       //return expect(xml1).to.eql(result1);
//     });
//   });
// });

// updateJSON
describe('create the JSON object', () => {
  describe('updateJSON()', () => {
    it('check the created JSON object', () => {
      const resultJSON = jsonToXML.updateJSON(ioentries.schema, dataitemvar);
      return expect(resultJSON).to.eql(ioentries.objJSON);
    });
  });
});
