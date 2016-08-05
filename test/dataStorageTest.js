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
const dataStorage = require('../src/dataStorage');
const ioEntries = require('./support/ioEntries');

// constants

const shdr = lokijs.getRawDataDB();
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
  const arr = [{ dataItemName: 'estop',
                uuid: '000',
                id: 'dtop_3',
                value: 'TRIGGERED',
                sequenceId: 1,
                time: 2 }];


  describe('when buffer is full, and the evicted value ', () => {
    it('is not backed up if that dataItem is present in buffer', () => {
      cbPtr.empty();
      shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 1, id: 'dtop_3', uuid: uuidVal, time: '2',
                   dataItemName: 'estop', value: 'TRIGGERED' });
      shdr.insert({ sequenceId: 2, id: idVal, uuid: uuidVal, time: '2',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 3, id: idVal, uuid: uuidVal, time: '2',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 4, id: idVal, uuid: uuidVal, time: '2',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 5, id: idVal, uuid: uuidVal, time: '2',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 6, id: idVal, uuid: uuidVal, time: '2',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 7, id: idVal, uuid: uuidVal, time: '2',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 8, id: idVal, uuid: uuidVal, time: '2',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 9, id: idVal, uuid: uuidVal, time: '2',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      shdr.insert({ sequenceId: 10, id: idVal, uuid: uuidVal, time: '2',
                   dataItemName: 'avail', value: 'AVAILABLE' });
      return expect(dataStorage.backUp.length).to.eql(0);
    });
    it('is stored in backed up if that dataItem is absent in buffer', () => {
      shdr.insert({ sequenceId: 10, id: idVal, uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'AVAILABLE' });
      return expect(dataStorage.backUp).to.eql(arr);
    });
  });
});

//TODO change the Test the functionality has been changed.
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
                  value: 'NORMAL' })

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
