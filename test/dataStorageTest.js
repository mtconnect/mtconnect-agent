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

    before(() => {
      shdr.clear();
      schemaPtr.clear();
      cbPtr.fill(null).empty();
    });

    after(() => {
      shdr.clear();
      schemaPtr.clear();
      cbPtr.fill(null).empty();
    });
    it('gives the recent entry if present ', () => {
      shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK' });
      const result = dataStorage.readFromCircularBuffer(cbPtr, idVal, uuidVal, 'avail');
      expect(result.value).to.eql(output1.value);


    });
    it('gives undefined if absent', () => {
      const result = dataStorage.readFromCircularBuffer(cbPtr, 'garbage', uuidVal, 'garbage');
      expect(result).to.eql(undefined);
    });
  });
});


describe('circularBuffer.overflow is called', () => {
  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
  });

  after(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
  });
  describe('when buffer is full and a new data comes', () => {
    it('the evicted data will be stored in hash map', () => {
      shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 1, id: 'dtop_3', uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'estop', value: 'TRIGGERED' });
      shdr.insert({ sequenceId: 2, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'UNAVAILABLE' });
      shdr.insert({ sequenceId: 3, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'UNAVAILABLE' });
      shdr.insert({ sequenceId: 4, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'UNAVAILABLE' });
      shdr.insert({ sequenceId: 5, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'UNAVAILABLE' });
      shdr.insert({ sequenceId: 6, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'UNAVAILABLE' });
      shdr.insert({ sequenceId: 7, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'UNAVAILABLE' });
      shdr.insert({ sequenceId: 8, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'UNAVAILABLE' });
      shdr.insert({ sequenceId: 9, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'UNAVAILABLE' });
      shdr.insert({ sequenceId: 10, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                   dataItemName: 'avail', value: 'UNAVAILABLE' });
      expect(dataStorage.hashLast.get('dtop_2').value).to.eql('AVAILABLE');
      shdr.insert({ sequenceId: 10, id: idVal, uuid: uuidVal, time: '2016-07-25T05:50:19.303002Z',
                    dataItemName: 'avail', value: 'UNAVAILABLE' });
      expect(dataStorage.hashLast.get('dtop_3').value).to.eql('TRIGGERED');
    });
  });
});

describe('categoriseDataItem() categorises the dataItem', () => {
  describe('into SAMPLE, EVENT, CONDITION', () => {
    before(() => {
      shdr.clear();
      schemaPtr.clear();
      cbPtr.fill(null).empty();
    });

    after(() => {
      shdr.clear();
      schemaPtr.clear();
      cbPtr.fill(null).empty();
    });
    it('and gives latest value of each dataItem', () => {
      shdr.insert({ sequenceId: 0, id: 'avail', uuid: uuidVal, time: '2',
                   value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 1, id:'estop', uuid: uuidVal, time: '2',
                   value: 'TRIGGERED' });
      shdr.insert({ sequenceId: 3, id: 'cl3', uuid: uuidVal, time: '2',
                   value: 'UNAVAILABLE' });
      shdr.insert({ sequenceId: 4, id: 'Xloadc', uuid: uuidVal, time: '2',
                  value: 'NORMAL' });

      const result = dataStorage.categoriseDataItem(ioEntries.schema, dataItemsArr, cbPtr);
      expect(result).to.eql(output2);
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
  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
  });

  after(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
  });

  it('gives hashLast as the checkpoint when the first data is being inserted ', () => {
    console.log(require('util').inspect(cbPtr, { depth: null }));
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    let cbArr = cbPtr.toArray()
    //console.log(require('util').inspect(cbArr, { depth: null }));
    expect(cbArr[0].checkPoint).to.eql(-1);
  });
  it('gives the least sequenceId if all the dataItems are present in circular buffer', () => {
    shdr.insert({ sequenceId: 2, id: 'dtop_3', uuid: uuidVal, time: '2',
                 value: 'AVAILABLE' });
    expect(cbPtr.data[2].checkPoint).to.eql(1);
  });
   it('gives hashLast as the checkpoint if atleast one of the dataItem is not present in CB', () => {
    shdr.insert({ sequenceId: 3, id: 'dtop_3', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 4, id: 'dtop_3', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 5, id: 'dtop_3', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 6, id: 'dtop_3', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 7, id: 'dtop_3', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 8, id: 'dtop_3', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 9, id: 'dtop_3', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 10, id: 'dtop_3', uuid: uuidVal, time: '2',
                value: 'LAST' });
    shdr.insert({ sequenceId: 11, id: 'dtop_3', uuid: uuidVal, time: '2',
                value: '11' });
    let cbArr1 = cbPtr.toArray()
    expect(cbArr1[9].checkPoint).to.eql(-1);
    shdr.insert({ sequenceId: 12, id: 'dtop_2', uuid: uuidVal, time: '2',
                value: '11' });
    let cbArr2 = cbPtr.toArray()
    expect(cbArr2[9].checkPoint).to.eql(11);
  });

});
