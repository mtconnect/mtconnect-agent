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

const lokijs = require('../src/lokijs');
const dataStorage = require('../src/dataStorage');
const ioEntries = require('./support/ioEntries');

// constants

const shdr = lokijs.getRawDataDB();
const schemaPtr = lokijs.getSchemaDB();
const cbPtr = dataStorage.circularBuffer;
const output1 = { dataItemName: 'avail',
  uuid: '000',
  id: 'dtop_2',
  value: 'CHECK',
  sequenceId: 0,
  time: '2',
 };

const output2 = { Event:
                     [ { Availability:
                          { '$': { dataItemId: 'avail', sequence: 0, timestamp: '2' },
                            _: 'AVAILABLE' } },
                       { EmergencyStop:
                          { '$': { dataItemId: 'estop', sequence: 1, timestamp: '2' },
                            _: 'TRIGGERED' } } ],
                  Sample:
                   [ { Load:
                        { '$': { dataItemId: 'cl3', sequence: 3, timestamp: '2', name: 'Cload' },
                          _: 'UNAVAILABLE' } } ],
                  Condition:
                   [ { Normal:
                        { '$':
                           { dataItemId: 'Xloadc',
                             sequence: 4,
                             timestamp: '2',
                             type: 'LOAD' } } } ] };

const dataItemsArr =[ { '$': { category: 'EVENT', id: 'avail', type: 'AVAILABILITY' } },
                      { '$': { category: 'EVENT', id: 'estop', type: 'EMERGENCY_STOP' } },
                      { '$': { category: 'SAMPLE', id: 'cl3', name: 'Cload',nativeUnits: 'PERCENT',
                      type: 'LOAD', units: 'PERCENT' } },
                      { '$': { category: 'CONDITION', id: 'Xloadc', type: 'LOAD' } } ];

const idVal = 'dtop_2';
const uuidVal = '000';

describe('readFromCircularBuffer()', () => {
  describe('searches circularBuffer for matching keys', () => {
    it('gives the recent entry if present ', () => {
      shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK' });
      const result = dataStorage.readFromCircularBuffer(cbPtr, idVal, uuidVal, 'avail');
      return expect(result).to.eql(output1);
    });
    it('gives undefined if absent', () => {
      const result = dataStorage.readFromCircularBuffer(cbPtr, 'garbage', uuidVal, 'garbage');
      return expect(result).to.eql(undefined);
    });
  });
});

describe('circularBuffer.overflow is called', () => {
  const evict2 = { dataItemName: 'estop',
                uuid: '000',
                id: 'dtop_3',
                value: 'TRIGGERED',
                sequenceId: 1,
                time: '2016-07-25T05:50:19.303002Z' };
  const evict1 = { dataItemName: 'avail',
                uuid: '000',
                id: 'dtop_2',
                value: 'AVAILABLE',
                sequenceId: 0,
                time: '2016-07-25T05:50:19.303002Z' };

  describe('when buffer is full and a new data comes', () => {
    it('the evicted data will be stored in hash map', () => {
      cbPtr.empty();
      shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 1, id: 'dtop_3', uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'estop', value: 'TRIGGERED' });
      shdr.insert({ sequenceId: 2, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 3, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 4, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 5, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 6, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 7, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 8, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 9, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 10, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      expect(dataStorage.hashLast.get('dtop_2')).to.eql(evict1);
      shdr.insert({ sequenceId: 10, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                    dataItemName: 'avail', value: 'AVAILABLE' });
      return expect(dataStorage.hashLast.get('dtop_3')).to.eql(evict2);
    });
  });
});

describe('categoriseDataItem() categorises the dataItem', () => {
  describe('into SAMPLE, EVENT, CONDITION', () => {
    it('and gives latest value of each dataItem', () => {
      cbPtr.empty();
      shdr.insert({ sequenceId: 0, id: 'avail', uuid: uuidVal, time: '2',
                   value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 1, id:'estop', uuid: uuidVal, time: '2',
                   value: 'TRIGGERED' });
      shdr.insert({ sequenceId: 3, id: 'cl3', uuid: uuidVal, time: '2',
                   value: 'UNAVAILABLE' });
      shdr.insert({ sequenceId: 4, id: 'Xloadc', uuid: uuidVal, time: '2',
                  value: 'NORMAL' });

      const result = dataStorage.categoriseDataItem(ioEntries.schema, dataItemsArr, cbPtr);
      return expect(result).to.eql(output2);
    });
  });
});


describe('pascalCase()', () => {
  it('converts the string to pascal case', () => {
    const str = 'hello_world';
    const str1 = 'helloworld';
    const pascalStr = 'HelloWorld';
    const pascalStr1 = 'Helloworld';
    const result = dataStorage.pascalCase(str);
    const result1 = dataStorage.pascalCase(str1);
    expect(result).to.eql(pascalStr);
    expect(result1).to.eql(pascalStr1);
  })
})

describe('checkPoint is updated on inserting data to database', () => {
  // shdr.clear();
  // schemaPtr.clear();
  // cbPtr.empty();
  // console.log(require('util').inspect(cbPtr.data, { depth: null }));
  // console.log(require('util').inspect(cbPtr.data, { depth: null }));
  // console.log(require('util').inspect(cbPtr.data, { depth: null }));
  it('gives hashLast as the checkpoint when the first data is being inserted ', () => {
    //const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    // cbPtr.empty();
    // console.log(require('util').inspect(cbPtr.data, { depth: null }));
    //lokijs.insertSchemaToDB(JSON.parse(jsonFile));
  });
  it('gives the least sequenceId if all the dataItems are present in circular buffer', () => {
    //console.log(require('util').inspect(cbPtr.data, { depth: null }));
  });
  it('gives hashLast as the checkpoint if atleast one of the dataItem is not present in CB', () => {
    //console.log(require('util').inspect(cbPtr.data, { depth: null }));
  });

});
