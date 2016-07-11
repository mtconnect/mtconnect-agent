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
 };

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
      const result = dataStorage.readFromCircularBuffer(cbPtr, idVal, uuidVal, 'garbage');
      return expect(result).to.eql(undefined);
    });
  });
});


describe('getDataItem() gives the dataitem', () => {
  it('with latest value', () => {
    cbPtr.empty();
    shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
                  dataItemName: 'avail', value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 1, id: 'dtop_3', uuid: uuidVal, time: '2',
                                dataItemName: 'estop', value: 'TRIGGERED' });
    const result = dataStorage.getDataItem(ioEntries.schema, cbPtr);
    return expect(result).to.eql(output2);
  });
});
