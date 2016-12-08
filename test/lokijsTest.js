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
const sinon = require('sinon');
const moment = require('moment');
// Imports - Internal

const ioEntries = require('./support/ioEntries');
const dataStorage = require('../src/dataStorage');
const lokijs = require('../src/lokijs');
const sameJSON = require('./support/sampleJSONOutput');
const differentJSON = require('./support/sampleJSONEdited');
const dataItem = require('./support/dataItem');
const log = require('../src/config/logger');
const config = require('../src/config/config');
// constants

const cbPtr = dataStorage.circularBuffer;
const schemaPtr = lokijs.getSchemaDB();
const rawData = lokijs.getRawDataDB();
const uuid = '000';
const result1 = { time: '2014-08-11T08:32:54.028533Z',
dataitem: [{ name: 'avail', value: 'AVAILABLE' }] };

const input1 = ioEntries.input1;
const dbResult1 = [{ dataItemName: 'avail',
                uuid: '000',
                id: 'dtop_2',
                value: 'AVAILABLE',
                sequenceId: 6,
                time: '2014-08-11T08:32:54.028533Z' }];

const insertedObject = {
  xmlns: { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  xmlns: 'urn:mtconnect.org:MTConnectDevices:1.3',
  'xmlns:m': 'urn:mtconnect.org:MTConnectDevices:1.3',
  'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectDevices:1.3 http://www.mtconnect.org/schemas/MTConnectDevices_1.3.xsd' },
  time: '2013-02-11T12:12:57Z',
  uuid: '000',
  device: { $:
   { name: 'VMC-3Axis',
     uuid: '000',
     id: 'dev' },
  Description:
   [{ $: { manufacturer: 'SystemInsights' } }],
  DataItems:
   [{ DataItem:
        [{ $:
             { type: 'AVAILABILITY',
               category: 'EVENT',
               id: 'dtop_2',
               name: 'avail' } },
          { $:
             { type: 'EMERGENCY_STOP',
               category: 'EVENT',
               id: 'dtop_3',
               name: 'estop' } },
           { $:
             { category: 'EVENT',
               id: 'dev_asset_chg',
               type: 'ASSET_CHANGED' } },
           { $:
              { category: 'EVENT',
                id: 'dev_asset_rem',
                type: 'ASSET_REMOVED' } },
             ] }] },
};


// test - insertSchemaToDB()


describe('insertSchematoDB()', () => {
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
  });

  after(() => {
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });
  describe('inserts the device schema', () => {
    it('into the database ', () => {
      const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
      lokijs.insertSchemaToDB(JSON.parse(jsonFile));
      const checkData = schemaPtr.data[0];

      expect(checkData.xmlns).to.eql(insertedObject.xmlns);
      expect(checkData.time).to.eql(insertedObject.time);
      expect(checkData.uuid).to.eql(insertedObject.uuid);
      expect(checkData.device).to.eql(insertedObject.device);
    });
  });
});


describe('getId()', () => {
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
  });

  after(() => {
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });
  describe('checks the schema for each dataItemName', () => {
    it('gives the Id if present', () => {
      const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
      lokijs.insertSchemaToDB(JSON.parse(jsonFile));
      expect(lokijs.getId(uuid, 'avail')).to.eql('dtop_2');
      expect(lokijs.getId(uuid, 'estop')).to.eql('dtop_3');
    });
  });
});


// test - compareschema()

describe('compareSchema()', () => {
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
  });

  after(() => {
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });
  describe('checks the database for duplicate entry', () => {
    it('with duplicate entry', () => {
      const check = lokijs.compareSchema(ioEntries.schema, sameJSON);
      expect(check).to.eql(true);
    });
    it('without duplicate entry', () => {
      const check = lokijs.compareSchema(ioEntries.schema, differentJSON);
      const check1 = lokijs.compareSchema(ioEntries.schemaTimeDiff, sameJSON);
      expect(check).to.eql(false);
      expect(check1).to.eql(false);
    });
  });
});


describe('searchDeviceSchema()', () => {
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
  });

  after(() => {
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });
  describe('checks the database for the latest', () => {
    it('device schema present for given uuid', () => {
      const xml1 = fs.readFileSync('./test/support/Devices2di.xml', 'utf8');
      lokijs.updateSchemaCollection(xml1);
      const schema = lokijs.searchDeviceSchema(uuid);
      const refSchema = ioEntries.refSchema[0];
      return expect(schema[0].device).to.eql(refSchema.device);
    });
  });
});


describe('On receiving new dataitems dataCollectionUpdate()', () => {
  describe('inserts to database and update circular buffer', () => {
    before(() => {
      rawData.clear();
      schemaPtr.clear();
      cbPtr.fill(null).empty();
    });

    after(() => {
      cbPtr.fill(null).empty();
      schemaPtr.clear();
      rawData.clear();
    });
    const schema = fs.readFileSync('./test/support/Devices2di.xml', 'utf8');
    const cb = dataStorage.circularBuffer;
    it('with number of dataItem less than buffer size', () => {
      schemaPtr.clear();
      lokijs.updateSchemaCollection(schema);
      cbPtr.fill(null).empty();
      dataStorage.hashCurrent.clear();
      dataStorage.hashLast.clear();
      lokijs.dataCollectionUpdate(result1, '000');
      const check1Obj = cb.toArray();
      expect(check1Obj[0].dataItemName).to.eql(dbResult1[0].dataItemName);
      expect(check1Obj[0].id).to.eql(dbResult1[0].id);
      expect(check1Obj[0].uuid).to.eql(dbResult1[0].uuid);
      return expect(check1Obj[0].value).to.eql(dbResult1[0].value);
    });
    it('with number of dataItem more than buffer size', () => {
      dataStorage.circularBuffer.empty();
      lokijs.dataCollectionUpdate(input1, '000');
      const check2Obj = cb.toArray();
      expect(check2Obj[0].value).to.eql('FIRST');
      expect(check2Obj[9].value).to.eql('LAST');
    });

    it('will not insert the dataItem to circular buffer if the value is same as previous entry', () => {
      const input = { time: '2014-08-11T08:32:54.028533Z',
      dataitem: [{ name: 'avail', value: 'THIRTEEN' }] };
      lokijs.dataCollectionUpdate(input, '000');
      const check3Obj = cb.toArray();
      expect(check3Obj[0].value).to.eql('FIRST');
      expect(check3Obj[9].value).to.eql('LAST');
    });

    it('will not increment sequenceId if the adjacent values are same', () => {
      const input = { time: '2', dataitem: [{ name: 'avail', value: 'FOURTEEN' }] };
      lokijs.dataCollectionUpdate(input, '000');
      const check3Obj = cb.toArray();
      const previousSequenceId = check3Obj[8].sequenceId;
      const currentSequenceId = check3Obj[9].sequenceId;
      expect(check3Obj[9].value).to.eql('FOURTEEN');
      expect(currentSequenceId).to.eql(previousSequenceId + 1);
    });
  });
});


describe('For dataItems with category as CONDITION', () => {
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    const schema = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8');
    lokijs.updateSchemaCollection(schema);
    cbPtr.fill(null).empty();
  });

  after(() => {
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });

  describe('if the previous value and received value is same', () => {
    it('will add to buffer if the Level is anything other than NORMAL', () => {
      const input = { time: '2010-09-29T23:59:33.460470Z',
                    dataitem:
                     [{ name: 'htemp',
                         value: ['WARNING', 'HTEMP', '1', 'HIGH', 'Oil Temperature High'] }] };
      lokijs.dataCollectionUpdate(input, '000');
      let check2Obj = cbPtr.toArray();
      expect(check2Obj[0].value[0]).to.eql('WARNING');
      lokijs.dataCollectionUpdate(input, '000');
      check2Obj = cbPtr.toArray();
      expect(check2Obj.length).to.eql(2);
      expect(check2Obj[1].value[0]).to.eql('WARNING');
    });

    it('will not add to buffer if the Level is NORMAL', () => {
      cbPtr.empty();
      const input = { time: '2016-07-25T05:50:29.303002Z',
                    dataitem: [{ name: 'clow', value: ['NORMAL', '', '', '', ''] }] };
      lokijs.dataCollectionUpdate(input, '000');
      let check2Obj = cbPtr.toArray();
      lokijs.dataCollectionUpdate(input, '000');
      expect(check2Obj[0].value[0]).to.eql('NORMAL');
      check2Obj = cbPtr.toArray();
      expect(check2Obj.length).to.eql(1);
    });
  });
});

describe('On receiving a device schema', () => {
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
  });

  after(() => {
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });
  describe('updateSchemaCollection()', () => {
    it('adds a new device schema', () => {
      const schemaEntries = schemaPtr.data.length;
      const schema = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8');
      lokijs.updateSchemaCollection(schema);
      return expect(schemaPtr.data.length).to.eql(schemaEntries + 1);
    });
    it('ignores if the schema already exist', () => {
      const schemaEntries = schemaPtr.data.length;
      const schema = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8');
      lokijs.updateSchemaCollection(schema);
      return expect(schemaPtr.data.length).to.eql(schemaEntries);
    });
    it('adds a new entry if it is an updated schema', () => {
      const schemaEntries = schemaPtr.data.length;
      const schema = fs.readFileSync('./test/support/VMC-3Axis-copy.xml', 'utf8');
      lokijs.updateSchemaCollection(schema);
      expect(schemaPtr.data.length).to.eql(schemaEntries + 1);
      // schemaPtr.clear();
      // rawData.clear();
    });
  });
});


describe('Parsing the device schema for dataitems and components', () => {
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
  });

  after(() => {
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });
  describe('and insert the dataitems into the rawData Collection', () => {
    it('with UNAVAILABLE as the default value except for constrained dataItems and those with type AVAILABILITY', () => {
      const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
      lokijs.insertSchemaToDB(JSON.parse(jsonFile));
      expect(rawData.maxId).to.eql(46);
      expect(rawData.data[5].value).to.eql('SPINDLE');
      expect(rawData.data[0].value).to.eql('AVAILABLE');
    });
  });
});

describe('getDataItem()', () => {
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
  });

  after(() => {
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });
  describe('get all the DataItems from the ', () => {
    it('latest device schema for given uuid', () => {
      const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
      lokijs.insertSchemaToDB(JSON.parse(jsonFile));
      const dataItemsArr = lokijs.getDataItem('000');
      expect(dataItemsArr.length).to.eql(46);
    });
  });
});


describe('hashCurrent()', () => {
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
  });

  after(() => {
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });
  describe('is updated on each data insertion', () => {
    it('and has UNVAILABLE as value initially for all except dataItem with type AVAILABILITY', () => {
      const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
      lokijs.insertSchemaToDB(JSON.parse(jsonFile));
      const hC = dataStorage.hashCurrent;
      const dataItem1 = hC.get('dtop_2');
      const dataItem2 = hC.get('dtop_3');
      expect(dataItem1.value).to.eql('AVAILABLE');
      expect(dataItem2.value).to.eql('UNAVAILABLE');
    });
    it('Recent value is updated on receiving raw data from adapter', () => {
      rawData.insert({ sequenceId: 2, uuid: '000', id: 'dtop_2', time: '2013-02-11T12:12:57Z', value: 'AVAILABLE' });
      rawData.insert({ sequenceId: 3, uuid: '000', id: 'dtop_3', time: '2013-02-11T12:12:57Z', value: 'TRIGGERED' });
      const hC = dataStorage.hashCurrent;
      const dataItem1 = hC.get('dtop_2');
      const dataItem2 = hC.get('dtop_3');
      expect(dataItem1.value).to.eql('AVAILABLE');
      expect(dataItem2.value).to.eql('TRIGGERED');
    });
  });
});

describe('rawDataInsert(), will check maxId and insert the object', () => {
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
  });

  after(() => {
    dataStorage.hashCurrent.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });

  it('if maxId is less than 1000', () => {
    for (let i = 0; i < 1000; i++) {
      lokijs.insertRawData({ sequenceId: i, uuid: '000', id: String(i), time: '2013-02-11T12:12:57Z', value: 'AVAILABLE' });
    }
    expect(rawData.maxId).to.eql(1000);
  });
  it('after clearing the database if maxId >= 1000', () => {
    lokijs.insertRawData({ sequenceId: 1000, uuid: '000', id: String(1000), time: '2013-02-11T12:12:57Z', value: 'AVAILABLE' });
    expect(rawData.maxId).to.eql(1);
  });
});

describe('updateBufferOnDisconnect()', () => {
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    rawData.insert({ sequenceId: 13, uuid: '000', id: 'dtop_3', time: '2', value: 'TRIGGERED' });
  });

  after(() => {
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });

  it('updates the value for all dataItems for tha device as UNAVAILABLE  in circularBuffer',() => {
    lokijs.updateBufferOnDisconnect(uuid);
    const bufferData = cbPtr.toArray();
    const length = bufferData.length;
    expect(length).to.eql(7);
    expect(bufferData[length - 1].id).to.eql('dtop_3');
    expect(bufferData[length - 1].value).to.eql('UNAVAILABLE');
    expect(bufferData[length - 2].id).to.eql('dtop_2');
    expect(bufferData[length - 2].value).to.eql('UNAVAILABLE');
  });

  it('updates the value for all dataItems for tha device as UNAVAILABLE  in hashCurrent',() => {
    const hC = dataStorage.hashCurrent;
    const avail = hC.get('dtop_2');
    const estop = hC.get('dtop_3');
    const assetChg = hC.get('dev_asset_chg');
    const assetRem = hC.get('dev_asset_rem')
    expect(avail.value).to.eql('UNAVAILABLE');
    expect(estop.value).to.eql('UNAVAILABLE');
    expect(assetChg.value).to.eql('UNAVAILABLE');
    expect(assetRem.value).to.eql('UNAVAILABLE');
    expect(avail.time).to.eql(estop.time);
    expect(avail.time).to.not.eql(assetChg.time);
    expect(assetChg.time).to.eql(assetRem.time)
  });

  it('does not update hashLast',() => {
    const hL = dataStorage.hashLast;
    const avail = hL.get('dtop_2');
    const estop = hL.get('dtop_3');
    const assetChg = hL.get('dev_asset_chg');
    const assetRem = hL.get('dev_asset_rem')
    expect(avail.value).to.eql('AVAILABLE');
    expect(estop.value).to.eql('UNAVAILABLE');
    expect(assetChg.value).to.eql('UNAVAILABLE');
    expect(assetRem.value).to.eql('UNAVAILABLE');
    expect(avail.time).to.eql(assetRem.time);
    expect(avail.time).to.eql(assetChg.time);
    expect(avail.time).to.eql(estop.time);
  });
});

describe('initiateCircularBuffer updates the circularBuffer', () => {
  const dataItems = dataItem.dataItems;
  const time = '2014-08-11T08:32:54.028533Z';
  let spy;

  before(() => {
    spy = sinon.spy(log, 'error');
    schemaPtr.clear();
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    cbPtr.fill(null).empty();
    rawData.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
  });

  after(() => {
    log.error.restore();
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });

  it('skips the duplicate dataItem after checking for duplicate Id', () => {
    lokijs.initiateCircularBuffer(dataItems, time, '000');
    expect(rawData.maxId).to.eql(47);
    lokijs.initiateCircularBuffer(dataItems, time, '000');
    expect(rawData.maxId).to.eql(47); // not added again as already present
    expect(spy.callCount).to.be.equal(47);
  });
});

describe('getTime() gives time depending on the configuration', () => {
  let stub;
  before(() => {
    stub = sinon.stub(config, 'getConfiguredVal');
    stub.withArgs('mRelativeTime').returns(false);
    stub.withArgs('mIgnoreTimestamps').returns(false);
  });

  after(() => {
    stub.restore();
  });
  let time2;
  let result2;
  it('when mRelativeTime & mIgnoreTimestamp = false, gives adapter Time', () => {
    const time1 = '2016-12-08T07:29:53.246Z';
    const result1 = lokijs.getTime(time1);
    expect(result1).to.eql(time1);
  });

  it('when ignoreTimestamps = true, mRelativeTime = false, gives currentTime', () => {
    stub.withArgs('mIgnoreTimestamps').returns(true);
    const time1 = '2016-12-08T07:29:53.246Z';
    const result1 = lokijs.getTime(time1);
    expect(moment(result1).valueOf()).to.be.greaterThan(moment(time1).valueOf());
  });

  it('when mRelativeTime = true and mBaseTime = 0, gives currentTime', () => {
    stub.withArgs('mRelativeTime').returns(true);
    stub.withArgs('mIgnoreTimestamps').returns(false);
    time2 = '2016-12-08T07:29:53.246Z';
    result2 = lokijs.getTime(time2);
    expect(moment(result2).valueOf()).to.be.greaterThan(moment(time2).valueOf());
  })

  it('when  mRelativeTime = true and mBaseTime != 0, gives relative time', () => {
    const time3 = '2016-12-08T07:30:53.246Z';
    const result3 = lokijs.getTime(time3);
    const timeDiff = moment(time3).valueOf() - moment(time2).valueOf();
    const resDiff = moment(result3).valueOf() - moment(result2).valueOf();
    expect(timeDiff).to.eql(resDiff);
  });
});
