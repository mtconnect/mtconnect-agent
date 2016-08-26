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
const hashLastArr = ['dtop_2', 'dtop_3'];

describe('readFromHashCurrent()', () => {
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
    it('gives the recent entry if present', () => {
      shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK' });
      const result = dataStorage.readFromHashCurrent(idVal);
      expect(result.value).to.eql('CHECK');


    });
    it('gives undefined if absent', () => {
      const result = dataStorage.readFromHashCurrent('garbage');
      expect(result).to.eql(undefined);
    });
  });
});


describe('hashLast is updated when the circular buffer overflows', () => {
  describe('readFromHashLast() searches hashLast for matching keys', () => {

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
    it('initially it will have an entry for all dataItem with value UNAVAILABLE', () => {
      const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
      lokijs.insertSchemaToDB(JSON.parse(jsonFile));
      const test1 = dataStorage.readFromHashLast('dtop_2');
      expect(dataStorage.hashLast.keys()).to.eql(hashLastArr);
      expect(test1.value).to.eql('UNAVAILABLE');
    });
    it('gives the dataItem present in hashLast for the id', () => {
      shdr.insert({ sequenceId: 0, id: 'id1', uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK1' });
      shdr.insert({ sequenceId: 0, id: 'id2', uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK2' });
      shdr.insert({ sequenceId: 0, id: 'id3', uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK3' });
      shdr.insert({ sequenceId: 0, id: 'id4', uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK4' });
      shdr.insert({ sequenceId: 0, id: 'id5', uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK5' });
      shdr.insert({ sequenceId: 0, id: 'id6', uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK6' });
      shdr.insert({ sequenceId: 0, id: 'id7', uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK7' });
      shdr.insert({ sequenceId: 0, id: 'id8', uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK8' });
      shdr.insert({ sequenceId: 0, id: 'id9', uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK9' });
      shdr.insert({ sequenceId: 0, id: 'id10', uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK10' });
      shdr.insert({ sequenceId: 0, id: 'id11', uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK11' });
      const result = dataStorage.readFromHashLast('id1');
      expect(result.value).to.eql('CHECK1');
    });
    it('gives undefined if absent', () => {
      const result = dataStorage.readFromHashCurrent('garbage');
      expect(result).to.eql(undefined);
    });
  });
});

describe('readFromCircularBuffer()', () => {
  describe('searches circularBuffer for given sequenceId if present in it', () => {
    it('gives the recent entry if present ', () => {
      shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
                    dataItemName: 'avail', value: 'CHECK' });
      const result = dataStorage.readFromCircularBuffer(0, idVal, uuidVal);
      return expect(result.value).to.eql('CHECK');
    });
    it('gives ERROR if sequenceId is out of range', () => {
      const result = dataStorage.readFromCircularBuffer(4, 'garbage', uuidVal);
      return expect(result).to.eql('ERROR');
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

      const result = dataStorage.categoriseDataItem(ioEntries.schema, dataItemsArr);
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
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    const cbArr = cbPtr.toArray();
    expect(cbArr[0].checkPoint).to.eql(-1);
  });
  it('gives the CheckPoint as \'null\' if sequenceId is not multiple of CheckPointIndex', () => {
    shdr.insert({ sequenceId: 3, id: 'dtop_3', uuid: uuidVal, time: '2',
                 value: 'AVAILABLE' });
    expect(cbPtr.data[2].checkPoint).to.eql(null);
  });
   it('gives hashLast as the checkpoint if atleast one of the dataItem is not present in CB', () => {
    shdr.insert({ sequenceId: 1000, id: 'dtop_3', uuid: uuidVal, time: '2',
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
    shdr.insert({ sequenceId: 2000, id: 'dtop_3', uuid: uuidVal, time: '2',
                value: '11' });
    let cbArr1 = cbPtr.toArray()
    expect(cbArr1[9].checkPoint).to.eql(-1);
  });
  it('gives the least sequenceId if all the dataItems are present in circular buffer', () => {
    shdr.insert({ sequenceId: 3000, id: 'dtop_2', uuid: uuidVal, time: '2',
                value: '11' });
    let cbArr2 = cbPtr.toArray();
    expect(cbArr2[9].checkPoint).to.eql(2000);

    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();

    const jsonFile = fs.readFileSync('./test/support/vmc_10di', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));

    shdr.insert({ sequenceId: 1000, id: 'avail', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 2000, id: 'c2', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 3000, id: 'x2', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 4000, id: 'y2', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 5000, id: 'cn2', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 6000, id: 'Frt', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 7000, id: 'msg', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 8000, id: 'p2', uuid: uuidVal, time: '2',
                value: 'LAST' });
    shdr.insert({ sequenceId: 9000, id: 'clow', uuid: uuidVal, time: '2',
                value: '11' });
    shdr.insert({ sequenceId: 10000, id: 'hlow', uuid: uuidVal, time: '2',
                value: '11' });
    const cbArr = cbPtr.toArray();
    expect(cbArr[9].checkPoint).to.eql(1000);
    shdr.insert({ sequenceId: 1000, id: 'avail', uuid: uuidVal, time: '2',
                value: 'AVAILABLE' });
    const cbArr1 = cbPtr.toArray();
    expect(cbArr1[9].checkPoint).to.eql(2000);
  });
});

describe('getRecentDataItemForSample create a sub array slicing circularBuffer', () => {
  describe('depending on the from and count value', () => {
    before(() => {
      shdr.clear();
      schemaPtr.clear();
      cbPtr.fill(null).empty();
      dataStorage.hashCurrent.clear();
      shdr.insert({ sequenceId: 1, id: 'dtop_2', uuid: uuidVal, time: '2',
                  value: 'ONE' });
      shdr.insert({ sequenceId: 2, id: 'dtop_3', uuid: uuidVal, time: '2',
                  value: 'TWO' });
      shdr.insert({ sequenceId: 3, id: 'dtop_2', uuid: uuidVal, time: '2',
                  value: 'THREE' });
      shdr.insert({ sequenceId: 4, id: 'dtop_3', uuid: uuidVal, time: '2',
                  value: 'FOUR' });
      shdr.insert({ sequenceId: 5, id: 'dtop_2', uuid: uuidVal, time: '2',
                  value: 'FIVE' });
      shdr.insert({ sequenceId: 6, id: 'dtop_3', uuid: uuidVal, time: '2',
                  value: 'SIX' });
      shdr.insert({ sequenceId: 7, id: 'dtop_3', uuid: uuidVal, time: '2',
                  value: 'SEVEN' });
      shdr.insert({ sequenceId: 8, id: 'dtop_2', uuid: uuidVal, time: '2',
                  value: 'EIGHT' });
      shdr.insert({ sequenceId: 9, id: 'dtop_2', uuid: uuidVal, time: '2',
                  value: 'NINE' });
      shdr.insert({ sequenceId: 10, id: 'dtop_3', uuid: uuidVal, time: '2',
                  value: 'TEN' });
    });

    after(() => {
      shdr.clear();
      schemaPtr.clear();
      cbPtr.fill(null).empty();
    });

    it('from and from+count within the range', () => {
      let result = dataStorage.getRecentDataItemForSample(7, 'dtop_3', '000', 3);
      expect(result[0].sequenceId).to.eql(7);
      expect(result.length).to.eql(1);
    });
    it('from value outside the range', () => {
      let result = dataStorage.getRecentDataItemForSample(11, 'dtop_3', '000', 3);
      console.log(require('util').inspect(result, { depth: null }));
      expect(result).to.eql('ERROR');
    });
    it.skip('from is within the range and count is 0', () => {
      //TODO give error invalid count.
      // let result = dataStorage.getRecentDataItemForSample(9, 'dtop_3', '000', 0);
      // console.log(require('util').inspect(result, { depth: null }));
      //expect(result).to.eql('ERROR');
    });
    it('from+count is outside the range', () => {
      let result = dataStorage.getRecentDataItemForSample(7, 'dtop_3', '000', 4);
      expect(result[0].sequenceId).to.eql(7);
      expect(result[1].sequenceId).to.eql(10);
    });

  });
});
