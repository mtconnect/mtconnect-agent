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

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const tmp = require('tmp');
const ip = require('ip');
const parse = require('xml-parser');
const agent = require('../src/agent');
const request = require('co-request');
const R = require('ramda')

// Imports - Internal

const log = require('../src/config/logger');
const common = require('../src/common');
const xmlToJSON = require('../src/xmlToJSON');
const dataStorage = require('../src/dataStorage');
const lokijs = require('../src/lokijs');
// const ag = require('../src/main');
const ioEntries = require('./support/ioEntries');
const config = require('../src/config/config');

// constants
const cbPtr = dataStorage.circularBuffer;
const schemaPtr = lokijs.getSchemaDB();
const rawData = lokijs.getRawDataDB();
const assetValueJSON = ioEntries.assetValueJSON;
const uuid = '';

const result1 = { time: '2014-08-11T08:32:54.028533Z',
dataitem: [{ name: 'avail', value: 'AVAILABLE' }] };

const result2 = { time: '2014-08-13T07:38:27.663Z',
  dataitem:
   [{ name: 'execution', value: 'UNAVAILABLE' },
     { name: 'line', value: 'UNAVAILABLE' },
     { name: 'mode', value: 'UNAVAILABLE' },
     { name: 'program', value: 'UNAVAILABLE' },
     { name: 'Fovr', value: 'UNAVAILABLE' },
     { name: 'Sovr', value: 'UNAVAILABLE' }] };

const result3 = { time: '2010-09-29T23:59:33.460470Z',
  dataitem:
   [{ name: 'htemp',
       value: ['WARNING', 'HTEMP', '1', 'HIGH', 'Oil Temperature High'] }] };
const result4 = { time: '2016-04-12T20:27:01.0530',
  dataitem: [{ name: 'Cloadc', value: ['NORMAL', '', '', '', ''] }] };

// Tests

describe('On receiving data from adapter', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'

  before(function* setup() {
    yield agent.start();
  });

  after(() => {
    agent.stop();
  });

  describe('inputParsing()', () => {
    const shdrString2 = '2014-08-13T07:38:27.663Z|execution|UNAVAILABLE|line|' +
                      'UNAVAILABLE|mode|UNAVAILABLE|' +
                      'program|UNAVAILABLE|Fovr|UNAVAILABLE|Sovr|UNAVAILABLE';
    const shdrString1 = '2014-08-11T08:32:54.028533Z|avail|AVAILABLE';
    const shdrString3 = '2010-09-29T23:59:33.460470Z|htemp|WARNING|HTEMP|1|HIGH|Oil Temperature High';
    const shdrString4 = '2016-04-12T20:27:01.0530|Cloadc|NORMAL||||';
    const shdrString5 = '|avail|AVAILABLE';
    const shdrString6 = '2016-09-29T23:59:33.460470Z|msg|CHG_INSRT|Change Inserts';
    const shdrString7 = '2016-09-29T23:59:33.460470Z|msg||Change Inserts';
    const shdrString8 = '2013-09-05T18:41:28.0960|alarm|OTHER|WaRNing|WARNING|ACTIVE|WaRNing Status Set';
    const expectedResult6 = { time: '2016-09-29T23:59:33.460470Z',
      dataitem: [{ name: 'msg', value: ['CHG_INSRT', 'Change Inserts'] }] };
    const expectedResult7 = { time: '2016-09-29T23:59:33.460470Z',
      dataitem: [{ name: 'msg', value: ['', 'Change Inserts'] }] };

    const expectedResult8 = { time: '2013-09-05T18:41:28.0960',
      dataitem:
       [{ name: 'alarm',
           value: ['OTHER', 'WaRNing', 'WARNING', 'ACTIVE', 'WaRNing Status Set'] }] };
    before(() => {
      schemaPtr.clear();
      dataStorage.hashAdapters.clear()
      const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
      lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    });

    after(() => {
      schemaPtr.clear();
      dataStorage.hashAdapters.clear()
    });

    it('parses shdr with single dataitem correctly', () => {
      dataStorage.hashCurrent.clear();
      const inputParsed = shdrString1.split('|')
      expect(common.inputParsing(inputParsed, uuid)).to.eql(result1);
    });
    it('parses shdr with multiple dataitem correctly', () => {
      const inputParsed = shdrString2.split('|')
      expect(common.inputParsing(inputParsed, uuid)).to.eql(result2);
    });
    it('parses dataitem with category CONDITION', () => {
      const inputParsed = shdrString3.split('|')
      expect(common.inputParsing(inputParsed, uuid)).to.eql(result3);
    });
    it('parses dataitem with category CONDITION and empty pipes correctly', () => {
      const inputParsed = shdrString4.split('|')
      expect(common.inputParsing(inputParsed, uuid)).to.eql(result4);
    });
    it('parses dataItem and updates time with current time, if time is not present', () => {
      const inputParsed = shdrString5.split('|')
      const result = common.inputParsing(inputParsed, uuid);
      expect(result.time).to.not.eql('');
    });
    it('parses dataItem \'MESSAGE\' with native code correctly', () => {
      const inputParsed = shdrString6.split('|')
      const result6 = common.inputParsing(inputParsed, uuid);
      expect(result6).to.eql(expectedResult6);
    });
    it('parses dataItem \'MESSAGE\' without native code correctly', () => {
      const inputParsed = shdrString7.split('|')
      const result7 = common.inputParsing(inputParsed, uuid);
      expect(result7).to.eql(expectedResult7);
    });
    it('parses dataItem `ALARM` correctly', () => {
      const uuid = '3f707e77-7b44-55a0-9aba-2a671d5e7089'
      const alarm = fs.readFileSync('./test/support/alarm.xml', 'utf8');
      const json = xmlToJSON.xmlToJSON(alarm);
      lokijs.insertSchemaToDB(json);
      const inputParsed = shdrString8.split('|')
      const result8 = common.inputParsing(inputParsed, uuid);
      expect(result8).to.eql(expectedResult8);
    });
  });
});

describe('TIME_SERIES data parsing', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const numbers = '3499359 3499094 3499121 3499172 3499204 3499256 3499286 3499332 3499342 3499343 3499286 3499244 3499179 3499129 3499071';
  const shdr1 = `2|Va|10||${numbers}`;
  const expectedResult = {
    time: '2',
    dataitem: [{
      isTimeSeries: true,
      name: 'Va',
      value: ['10', '', numbers],
    }],
  };

  let stub;
  let stub1;

  before(function *setupTime() {
    yield agent.start();
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    dataStorage.hashAdapters.clear()
    const timeSeries = fs.readFileSync('./test/support/time_series.xml', 'utf8');
    lokijs.updateSchemaCollection(timeSeries);
    stub = sinon.stub(common, 'getAllDeviceUuids');
    stub1 = sinon.stub(dataStorage, 'getConfiguredVal');
    stub.withArgs('lol', 'RelativeTime').returns(false);
    stub.withArgs('lol', 'IgnoreTimestamps').returns(false);
    stub.withArgs('lol', 'ConversionRequired').returns(false);
    stub.returns([uuid]);
  });

  after(() => {
    agent.stop();
    stub1.restore();
    stub.restore();
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashAdapters.clear()
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });

  it('parses data to get Sample rate, Sample Count and array of values', () => {
    const inputParsed = shdr1.split('|')
    const jsonObj = common.inputParsing(inputParsed, uuid);
    expect(jsonObj).to.eql(expectedResult);
    lokijs.dataCollectionUpdate(jsonObj, uuid);
    const length = rawData.data.length;
    const data = rawData.data[length - 1];
    expect(data.dataItemName).to.eql('Va');
    expect(data.value[0]).to.eql(expectedResult.dataitem[0].value[2]);
  });

  it('On /current gives the array of values', function *current() {
    const host = ip.address();
    const port = 7000;
    const path = '/current?path=//Devices//Device[@name="lol"]//Systems//Electric//DataItem[@type="VOLTAGE"]';
    const { body } = yield request(`http://${host}:${port}${path}`);
    const obj = parse(body);
    const root = obj.root;
    const child = root.children[1].children[0].children[0];
    const childA = child.children[0].children;
    const child1 = child.children[0].children[0];
    const attributes = child1.attributes;
    expect(child.attributes.component).to.eql('Electric');
    expect(child1.name).to.eql('VoltageTimeSeries');
    expect(attributes.name).to.eql('Va');
    expect(attributes.sampleCount).to.eql('10');
    expect(attributes.sampleRate).to.eql('0');
    expect(child1.content).to.eql(expectedResult.dataitem[0].value[2]);
    expect(childA.length).to.eql(3);
  });

  it('On /sample gives the array of values', function *sample() {
    const shdr2 = '2|Va|5||3499359 3499094 3499121 3499172 3499204';
    common.parsing(shdr2, uuid)

    const sequence = dataStorage.getSequence();
    const fromVal = sequence.lastSequence - 1;
    const host = ip.address();
    const port = 7000;
    const path = `/sample?path=//Electric//DataItem[@type="VOLTAGE"]&from=${fromVal}&count=2`;
    const { body } = yield request(`http://${host}:${port}${path}`);
    const { root } = parse(body);
    const child = root.children[1].children[0].children[0];
    const childA = child.children[0].children;
    const child1 = child.children[0].children[0];
    const child2 = child.children[0].children[1];
    const content2 = '3499359 3499094 3499121 3499172 3499204';
    const attributes = child1.attributes;
    expect(child.attributes.component).to.eql('Electric');
    expect(child1.name).to.eql('VoltageTimeSeries');
    expect(attributes.name).to.eql('Va');
    expect(attributes.sampleCount).to.eql('10');
    expect(attributes.sampleRate).to.eql('0');
    expect(child1.content).to.eql(expectedResult.dataitem[0].value[2]);
    expect(child2.content).to.eql(content2);
    expect(childA.length).to.eql(2);
  });
});


describe('For every Device', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
  });

  after(() => {
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });

  describe('getDeviceUuid()', () => {
    it('get the uuid for the given DeviceName if present', () => {
      const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
      lokijs.insertSchemaToDB(JSON.parse(jsonFile));
      expect(common.getDeviceUuid('VMC-3Axis')).to.eql(uuid);
    });

    it('gives undefined if not present', () => {
      expect(common.getDeviceUuid('VMC-3Axis-1')).to.eql(undefined);
    });
  });
});

describe('processError', () => {
  describe('without exit', () => {
    it('should just log and return', () => {
      common.processError('Test', false);
    });
  });

  describe('with exit', () => {
    let save;
    let spy;

    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'error');
    });

    after(() => {
      save.restore();
      log.error.restore();
    });

    it('should log and exit', () => {
      save.yields(common.processError('Test', true));
      expect(spy.callCount).to.be.equal(1);
    });
  });
});

describe('pathValidation, check whether the path is a valid one', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashDataItemsByName.clear()
    dataStorage.hashLast.clear();
  });

  after(() => {
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashDataItemsByName.clear()
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });

  it('returns true if valid', () => {
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    const result = lokijs.pathValidation('//DataItem[@type="AVAILABILITY"]', [uuid]);
    expect(result).to.eql(true);
  });

  it('returns false if not valid', () => {
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    const result = lokijs.pathValidation('//Axes', [uuid]);
    expect(result).to.eql(false);
  });
});

describe('get MTConnect version from XML', () => {
  let version;

  context('success', () => {
    before(() => {
      const deviceXML = fs.readFileSync('test/support/VMC-3Axis.xml', 'utf8');
      version = common.getMTConnectVersion(deviceXML);
    });

    it('should return the correct version number', () => {
      expect(version).to.eql('1.3');
    });
  });

  context('failure', () => {
    let spy;

    before(() => {
      spy = sinon.spy(log, 'error');

      const deviceXML = fs.readFileSync('test/support/VMC-3Axis-no-version.xml', 'utf8');
      version = common.getMTConnectVersion(deviceXML);
    });

    after(() => {
      log.error.restore();
    });

    it('must log error', () => {
      expect(version).to.be.equal(null);
      expect(spy.callCount).to.be.equal(1);
    });
  });
});

describe('MTConnect validate', () => {
  context('success', () => {
    let status;

    before(() => {
      const deviceXML = fs.readFileSync('test/support/VMC-3Axis.xml', 'utf8');
      status = common.mtConnectValidate(deviceXML);
    });

    it('should return true', () => {
      expect(status).to.be.equal(true);
    });
  });

  context('no version', () => {
    let status;
    let spy;

    before(() => {
      spy = sinon.spy(log, 'error');

      const deviceXML = fs.readFileSync('test/support/VMC-3Axis-no-version.xml', 'utf8');
      status = common.mtConnectValidate(deviceXML);
    });

    after(() => {
      log.error.restore();
    });

    it('must log error', () => {
      expect(status).to.be.equal(false);
      expect(spy.callCount).to.be.equal(1);
    });
  });

  context('non-supported version', () => {
    let status;

    before(() => {
      sinon.spy(log, 'error');
      const deviceXML = fs.readFileSync('test/support/VMC-3Axis-non-supported-version.xml', 'utf8');
      status = common.mtConnectValidate(deviceXML);
    });

    after(() => {
      log.error.restore();
    });

    it('must log error', () => {
      expect(status).to.be.equal(false);
    });
  });

  context('validation failure', () => {
    let status;

    before(() => {
      sinon.spy(log, 'error');
      const deviceXML = fs.readFileSync('test/support/VMC-3Axis-validation-fail.xml', 'utf8');
      status = common.mtConnectValidate(deviceXML);
    });

    after(() => {
      log.error.restore();
    });

    it('must log error', () => {
      expect(status).to.be.equal(false);
    });
  });

  context('writeFileSync error', () => {
    let save;
    let spy;
    let status;

    before(() => {
      save = sinon.stub(tmp, 'tmpNameSync');
      save.onCall(0).returns('/tmpoo/foo.xml');

      spy = sinon.spy(log, 'error');

      const deviceXML = fs.readFileSync('test/support/VMC-3Axis.xml', 'utf8');
      status = common.mtConnectValidate(deviceXML);
    });

    after(() => {
      log.error.restore();

      tmp.tmpNameSync.restore();
    });

    it('should fail creating write file', () => {
      expect(status).to.be.equal(false);
      expect(spy.callCount).to.be.equal(1);
    });
  });
});

describe('getCurrentTimeInSec()', () => {
  it('gives the present time in seconds', (done) => {
    const time1 = common.getCurrentTimeInSec();
    setTimeout(() => {
      const time2 = common.getCurrentTimeInSec();
      expect(time1).to.be.lessThan(time2);
      done();
    }, 1000);
  });
});


describe('getAllDeviceUuids', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  before(() => {
    schemaPtr.clear()
    rawData.clear()
    dataStorage.hashAdapters.clear()
  })

  after(()=> {
    schemaPtr.clear()
    rawData.clear()
    dataStorage.hashAdapters.clear()
  })

  it('gives uuids of all the devices present', () => {
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    const uuidSet = common.getAllDeviceUuids();
    
    expect(uuidSet).to.eql([uuid]);
  });
});

// describe.skip('duplicateUuidCheck()', () => {
//   let devices = ag.devices;
//   it('does not add device with existing to the device collection', () => {
//     devices.insert({ uuid: '000', address: '192.168.100.4', port: 7000 });
//     common.duplicateUuidCheck('000', devices);
//   });
// });

/* ******************************* Asset ************************************* */
describe('updateAssetCollection() parses the SHDR data and', () => {
  let stub;
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const shdr1 = '2012-02-21T23:59:33.460470Z|@ASSET@|EM233|CuttingTool|<CuttingTool serialNumber="ABC" toolId="10" assetId="ABC">' +
  '<Description></Description><CuttingToolLifeCycle><ToolLife countDirection="UP" limit="0" type="MINUTES">160</ToolLife>' +
  '<Location type="POT">10</Location><Measurements><FunctionalLength code="LF" minimum="0" nominal="3.7963">3.7963</FunctionalLength>' +
  '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>';
  const { assetBuffer } = dataStorage;
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashAssetCurrent.clear();
    assetBuffer.fill(null).empty();
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    stub = sinon.stub(common, 'getAllDeviceUuids');
    stub.returns([uuid]);
  });

  after(() => {
    stub.restore();
    assetBuffer.fill(null).empty();
    dataStorage.hashAssetCurrent.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });

  it('update the assetBuffer and hashAssetCurrent with the data', () => {
    common.parsing(shdr1, uuid)

    const assetData = dataStorage.hashAssetCurrent.get('EM233');
    expect(assetData.time).to.eql('2012-02-21T23:59:33.460470Z');
    expect(assetData.assetType).to.eql('CuttingTool');
    expect(assetBuffer.data[0].assetType).to.eql('CuttingTool');
  });

  it('@UPDATE_ASSET@, updates the change received in the new data', () => {
    const update1 = '2012-02-21T23:59:34.460470Z|@UPDATE_ASSET@|EM233|ToolLife|120|CuttingDiameterMax|40';
    common.parsing(update1, uuid)
  
    const updatedAsset = dataStorage.hashAssetCurrent.get('EM233');
    const CuttingToolLifeCycle = updatedAsset.value.CuttingTool.CuttingToolLifeCycle[0];
    const value1 = CuttingToolLifeCycle.ToolLife[0]._;
    const value2 = CuttingToolLifeCycle.Measurements[0].CuttingDiameterMax[0]._;
    const assetArray = assetBuffer.toArray();
    const newData = assetArray[assetArray.length - 1];
    const time = '2012-02-21T23:59:34.460470Z';
    expect(updatedAsset.time).to.eql(time);
    expect(value1).to.eql('120');
    expect(value2).to.eql('40');
    expect(newData.time).to.eql(time);
  });

  it('updates the ASSET_CHANGED event', () => {
    const id = lokijs.getDataItem(uuid, 'assetChange').$.id
    const updatedData = dataStorage.hashCurrent.get(id);
    expect(updatedData.value).to.eql('EM233');
    const bufferArray = dataStorage.circularBuffer.toArray();
    const length = bufferArray.length;
    const bufferData = bufferArray[length - 1];
    expect(bufferData.id).to.eql(id);
    return expect(bufferData.value).to.eql('EM233');
  });
});

describe('@UPDATE_ASSET@ with dataItem recieved in xml format and multiple active statuses', () => {
  let stub;
  const assetBuffer = dataStorage.assetBuffer;
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  before(function *update() {
    yield agent.start();
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
    assetBuffer.fill(null).empty();
    dataStorage.hashAssetCurrent.clear();
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    stub = sinon.stub(common, 'getAllDeviceUuids');
    stub.returns(['000']);
  });

  after(() => {
    agent.stop();
    stub.restore();
    dataStorage.hashAssetCurrent.clear();
    assetBuffer.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });

  const asset1 = '2012-02-21T23:59:33.460470Z|@ASSET@|KSSP300R.1|CuttingTool|--multiline--0FED07ACED\n' +
  '<CuttingTool serialNumber="1" toolId="KSSP300R4SD43L240" assetId=" KSSP300R.1" manufacturers="KMT,Parlec">\n' +
    '<CuttingToolLifeCycle>\n' +
      '<CutterStatus><Status>NEW</Status></CutterStatus>\n' +
      '<ToolLife type="PART_COUNT" initial="0" countDirection="UP" limit="10">0</ToolLife>\n' +
      '<ProgramToolNumber>1</ProgramToolNumber>\n' +
      '<Measurements>\n' +
        '<OverallToolLength nominal="323.85" minimum="323.596" maximum="324.104" code="OAL">323.86</OverallToolLength>\n' +
        '<CuttingDiameterMax code="DC" nominal="76.2" maximum="76.213" minimum="76.187">76.262</CuttingDiameterMax>\n' +
      '</Measurements>\n' +
    '</CuttingToolLifeCycle>\n' +
	'</CuttingTool>\n' +
	'--multiline--0FED07ACED\n';

  const expectedVal = [{ _: '323.65', $: { nominal: '323.65', minimum: '323.60', maximum: '324.124', code: 'OAL' } }];

  const update1 = '2012-02-21T23:59:33.460470Z|@UPDATE_ASSET@|KSSP300R.1|' +
  '<OverallToolLength nominal="323.65" minimum="323.60" maximum="324.124" code="OAL">323.65</OverallToolLength>';

  const update2 = '2012-02-21T23:59:33.460470Z|@UPDATE_ASSET@|KSSP300R.1|CutterStatus|USED,AVAILABLE';

  it('updates the assetBuffer and hashAssetCurrent', () => {
    const arr = [asset1, update1, update2]
    R.map((str) => {
      common.parsing(str, uuid)
    }, arr)
    
    const id = 'KSSP300R.1';
    /* check hashAssetCurrent */
    const updatedData = dataStorage.hashAssetCurrent.get(id);
    const measurement = updatedData.value.CuttingTool.CuttingToolLifeCycle[0].Measurements;
    const OverallToolLength = measurement[0].OverallToolLength;
    expect(OverallToolLength).to.eql(expectedVal);
    /* check assetBuffer */
    const bufferArray = assetBuffer.toArray();
    const length = bufferArray.length;
    const recentData = bufferArray[length - 1];
    const measurement1 = recentData.value.CuttingTool.CuttingToolLifeCycle[0].Measurements;
    const OverallToolLength1 = measurement1[0].OverallToolLength;
    expect(recentData.assetId).to.eql(id);
    expect(OverallToolLength1).to.eql(expectedVal);
  });

  it('updates ASSET_CHANGED event with assetId', () => {
    const id = lokijs.getDataItem(uuid, 'assetChange').$.id
    const bufferArray = dataStorage.circularBuffer.toArray();
    const length = bufferArray.length;
    const bufferData = bufferArray[length - 1];
    expect(bufferData.id).to.eql(id);
    return expect(bufferData.value).to.eql('KSSP300R.1');
  });

  it('/asset', function *assets() {
    const { body } = yield request('http://0.0.0.0:7000/assets');
    const obj = parse(body);
    const root = obj.root;
    const child = root.children[1].children[0].children[0].children[0].children;
    expect(child[0].name).to.eql(child[1].name);
    expect(child[0].content).to.eql('USED');
    expect(child[1].content).to.eql('AVAILABLE');
  });
});

// TODO modify test on receiving shdr from Will
describe('@REMOVE_ASSET@', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const assetBuffer = dataStorage.assetBuffer;
  let shdr1 = '2|@ASSET@|EM233|CuttingTool|<CuttingTool serialNumber="ABC" toolId="10" assetId="ABC">' +
  '<Description></Description><CuttingToolLifeCycle><ToolLife countDirection="UP" limit="0" type="MINUTES">160</ToolLife>' +
  '<Location type="POT">10</Location><Measurements><FunctionalLength code="LF" minimum="0" nominal="3.7963">3.7963</FunctionalLength>' +
  '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>';
  let shdr2 = '2012-02-21T23:59:34.460470Z|@REMOVE_ASSET@|EM233';
  let stub;
  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
    assetBuffer.fill(null).empty();
    dataStorage.hashAssetCurrent.clear();
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    stub = sinon.stub(common, 'getAllDeviceUuids');
    stub.returns([uuid]);
  });

  after(() => {
    stub.restore();
    dataStorage.hashAssetCurrent.clear();
    assetBuffer.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });

  it('asset has been removed from the assetCollection', () => {
    const arr = [shdr1, shdr2]
    R.map((str) => {
      common.parsing(str, uuid)
    }, arr)
    
    const removedData = dataStorage.hashAssetCurrent.get('EM233');
    return expect(removedData.removed).to.eql(true);
  });

  it('updates the ASSET_REMOVED event', () => {
    const id = lokijs.getDataItem(uuid, 'assetRemove').$.id;
    const assetId = 'EM233';
    const removedData = dataStorage.hashCurrent.get(id);
    expect(removedData.value).to.eql(assetId);
    const bufferArray = dataStorage.circularBuffer.toArray();
    const length = bufferArray.length;
    const bufferData = bufferArray[length - 1];
    expect(bufferData.id).to.eql(id);
    return expect(bufferData.value).to.eql(assetId);
  });

  it('updates ASSET_CHANGED event if the removed asset is the last changed asset', () => {
    const id = lokijs.getDataItem(uuid, 'assetChange').$.id;
    const assetId = 'UNAVAILABLE';
    const updatedAsset = dataStorage.hashCurrent.get(id);
    expect(updatedAsset.value).to.eql(assetId);
    const bufferArray = dataStorage.circularBuffer.toArray();
    const length = bufferArray.length;
    const bufferData = bufferArray[length - 2];
    expect(bufferData.id).to.eql(id);
    return expect(bufferData.value).to.eql(assetId);
  });

  it('@REMOVE_ALL_ASSETS@, removes all assets of the type specified.', () => {
    shdr1 = '2016-07-25T05:50:25.123456Z|@ASSET@|EM262|CuttingTool|<CuttingTool serialNumber="XYZ" toolId="11" assetId="XYZ">' +
    '<Description></Description><CuttingToolLifeCycle><ToolLife countDirection="UP" limit="0" type="MINUTES">341</ToolLife>' +
    '<Location type="POT">11</Location><Measurements><FunctionalLength code="LF" minimum="0" nominal="4.12213">4.12213</FunctionalLength>' +
    '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>';
    common.parsing(shdr1, uuid)
    
    const id1 = lokijs.getDataItem(uuid, 'assetChange').$.id;
    const id2 = lokijs.getDataItem(uuid, 'assetRemove').$.id;
    let bufferArray = dataStorage.circularBuffer.toArray();
    let length = bufferArray.length;
    expect(bufferArray[length - 1].value).to.eql('EM262');
    shdr2 = '2012-02-21T23:59:34.460470Z|@REMOVE_ALL_ASSETS@|CuttingTool';
    common.parsing(shdr2, uuid)
    
    bufferArray = dataStorage.circularBuffer.toArray();
    length = bufferArray.length;
    expect(bufferArray[length - 1].id).to.eql(id2);
    expect(bufferArray[length - 1].value).to.eql('EM262');
    expect(bufferArray[length - 2].id).to.eql(id1);
    expect(bufferArray[length - 2].value).to.eql('UNAVAILABLE');
  });
});

describe('--multiline--', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const assetBuffer = dataStorage.assetBuffer;
  const shdr1 = '2012-02-21T23:59:33.460470Z|@ASSET@|EM233|CuttingTool|--multiline--OFED07ACED\n' +
  '<CuttingTool serialNumber="ABC" toolId="10" assetId="ABC">\n' +
  '<CuttingToolLifeCycle>\n' +
  '<CutterStatus><Status>NEW</Status></CutterStatus>\n' +
  '<ToolLife countDirection="UP" limit="0" type="MINUTES">160</ToolLife>' +
  '<Location type="POT">10</Location>\n' +
  '<Measurements>\n' +
  '<FunctionalLength code="LF" minimum="0" nominal="3.7963">3.7963</FunctionalLength>' +
  '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax>\n' +
  '</Measurements>\n' +
  '</CuttingToolLifeCycle>\n' +
  '</CuttingTool>\n' +
  '--multiline--OFED07ACED\n';
  let stub;

  before(() => {
    rawData.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashLast.clear();
    dataStorage.hashCurrent.clear();
    assetBuffer.fill(null).empty();
    dataStorage.hashAssetCurrent.clear();
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    stub = sinon.stub(common, 'getAllDeviceUuids');
    stub.returns([uuid]);
    common.parsing(shdr1, uuid)
    
  });

  after(() => {
    stub.restore();
    dataStorage.hashAssetCurrent.clear();
    assetBuffer.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    rawData.clear();
  });

  it('will parse the multiline asset and add to hashAssetCurrent and assetBuffer', () => {
    const assetData1 = dataStorage.hashAssetCurrent.get('EM233');
    const assetData2 = (assetBuffer.toArray())[0];
    const time = '2012-02-21T23:59:33.460470Z';
    expect(assetData1.time).to.eql(time);
    expect(assetData1.assetId).to.eql('EM233');
    expect(assetData1.assetType).to.eql('CuttingTool');
    expect(assetData1.value).to.eql(assetValueJSON);
    expect(assetData2.time).to.eql(time);
    expect(assetData2.assetId).to.eql('EM233');
    expect(assetData2.assetType).to.eql('CuttingTool');
    expect(assetData2.value).to.eql(assetValueJSON);
  });
});

describe('badAsset', ()=>{
  let stub
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const badAsset = 'TIME|@ASSET@|111|CuttingTool|--multiline--AAAA\n'+
  '<CuttingTool serialNumber="@11" toolId="11" assetId="@11">'+
    '<Description>Tool number: 11</Description>'+
    '<CuttingToolLifeCycle>'+
      '<CutterStatus>'+
        '<Status>AVAILABLE</Status>'+
      '</CutterStatus>'+
      '<Location type="POT">0</Location>'+
      '<ProgramToolNumber>11</ProgramToolNumber>'+
      '<Measurements>'+
        '<FunctionalLength code="LF" nominal="188.1378">188.1371</FunctionalLength>'+
        '<CuttingDiameter code="DC" nominal="25.4">25.3986</CuttingDiameter>'+
      '</Measurements>'+
      '<CuttingItems count="3">'+
        '<CuttingItem indices="1">'+
          '<Description>DRILLING</Description>'+
          '<Measurements>'+
            '<FunctionalLength code="LF1" nominal="188.1378">188.1371</FunctionalLength>'+
            '<CuttingDiameter code="DC1" nominal="25.4">25.3986</CuttingDiameter>'+
            '<CornerRadius code="RE" nominal="0">0</CornerRadius>'+
            '<PointAngle code="SIG" nominal="0">0</PointAngle>'+
          '</Measurements>'+
        '<CuttingItem indices="2">'+
          '<Description>DRILLING</Description>'+
          '<Measurements>'+
            '<FunctionalLength code="LF2" nominal="0">0</FunctionalLength>'+
            '<CuttingDiameter code="DC2" nominal="0">0</CuttingDiameter>'+
            '<CornerRadius code="RE" nominal="0">0</CornerRadius>'+
            '<PointAngle code="SIG" nominal="0">0</PointAngle>'+
          '</Measurements>'+
        '<CuttingItem indices="3">'+
          '<Description>DRILLING</Description>'+
          '<Measurements>'+
            '<FunctionalLength code="LF3" nominal="0">-2.5398</FunctionalLength>'+
            '<CuttingDiameter code="DC3" nominal="0">-5.0796</CuttingDiameter>'+
            '<CornerRadius code="RE" nominal="0">0</CornerRadius>'+
            '<PointAngle code="SIG" nominal="0">0</PointAngle>'+
          '</Measurements>'+
        '</CuttingItmems>'+
      '</CuttingToolLifeCycle>'+
    '</CuttingTool>'+
    '--multiline--AAAA\n'
  
  before(()=>{
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
  })

  after(()=>{
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    stub.restore()
  })

  it('returns empty hashAssetCurrent and assetBuffer', (done)=>{
    common.parsing(badAsset, uuid)
  
    expect(dataStorage.hashAssetCurrent._count).to.eql(0)
    expect(dataStorage.assetBuffer.length).to.eql(0)
    done()
  })
})
