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
const parse = require('xml-parser');
const inspect = require('util').inspect;
const http = require('http');
const R = require('ramda');
const ip = require('ip');

// Imports - Internal
const dataStorage = require('../src/dataStorage');
const lokijs = require('../src/lokijs');
const jsonToXML = require('../src/jsonToXML');
const ioEntries = require('./support/ioEntries');
const inputJSON = require('./support/sampleJSONOutput');
const json1 = require('./support/json1');
const json2 = require('./support/json2');
const deviceJSON = require('./support/deviceJSON');
const ag = require('../src/main');
const common = require('../src/common');

// constants
const cbPtr = dataStorage.circularBuffer;
const schemaPtr = lokijs.getSchemaDB();
const shdr = lokijs.getRawDataDB();
const dataItemInitial = ioEntries.dataItemInitial;
const dataItemWithVal = ioEntries.dataItemWithVal;
const dataItemForSample = ioEntries.dataItemForSample;
const dataItemForCount = ioEntries.dataItemForCount;
const dataItemsArr = [ { '$': { type: 'AVAILABILITY', category: 'EVENT',
       id: 'dtop_2', name: 'avail' }, path: '//DataItem' },
  { '$': { type: 'EMERGENCY_STOP', category: 'EVENT', id: 'dtop_3',
       name: 'estop' }, path: '//DataItem' } ];
const attributes = { name: 'VMC-3Axis', uuid: '000' };
const schema = ioEntries.schema[0];
const uuidCollection = ['000'];


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
      const resultJSON = jsonToXML.updateJSON(ioEntries.schema, dataItemInitial);
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


describe('findDataItemForSample()', () => {
  describe('gives the array of DataItem entries for the given id', () => {
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

    it('if present', () => {
      const slicedArray = ioEntries.slicedArray;
      const resultArr = jsonToXML.findDataItemForSample(slicedArray, 'dtop_2');
      const resultArr1 = jsonToXML.findDataItemForSample(slicedArray, 'dtop_3');
      expect(resultArr[0].Availability._).to.eql('UNAVAILABLE');
      expect(resultArr[1].Availability._).to.eql('AVAILABLE');
      expect(resultArr1[0].EmergencyStop._).to.eql('ARMED');
      expect(resultArr1[1].EmergencyStop._).to.eql('TRIGGERED');
    });

    it('if absent', () => {
      const slicedArray = ioEntries.slicedArray;
      const resultArr = jsonToXML.findDataItemForSample(slicedArray, 'dtop');
      expect(resultArr).to.eql(undefined);
    })
  })
});


describe('concatenateDeviceStreams()', () => {
  it('concatenates multiple device streams into one JSON object', () => {
      const jsonArr = [];
      jsonArr[0] = json1;
      jsonArr[1] = json2;
      let result = jsonToXML.concatenateDeviceStreams(jsonArr);
      let devices = result.MTConnectStreams.Streams[0].DeviceStream;
      expect(devices.length).to.eql(2);
  });
});

describe('concatenateDevices()', () => {
  it('concatenate multiple devices into one JSON object', () => {
    const jsonArr = [];
    jsonArr[0] = deviceJSON;
    jsonArr[1] = deviceJSON;
    let result = jsonToXML.concatenateDevices(jsonArr);
    let devices = result.MTConnectDevices.Devices[0].Device;
    expect(devices.length).to.eql(2);
  });
});

describe('calculateSequence() calculate the nextSequence depending on request type', () => {
  let stub;
  let obj = {
    firstSequence: 0,
    lastSequence: 10,
    nextSequence: 5
  }
  before(() => {
    stub = sinon.stub(dataStorage, 'getSequence');
    stub.returns(obj);
  });

  after(() => {
    stub.restore();
  });

  it('for /current it will be lastSequence + 1', () => {
     let result = jsonToXML.calculateSequence();
     expect(result.nextSequence).to.eql(obj.lastSequence + 1);
     console.log(require('util').inspect(result, { depth: null }));
  })
  it('for /sample it will be the last sequenceId + 1, in the sample set', () => {
    let result = jsonToXML.calculateSequence('SAMPLE');
    expect(result.nextSequence).to.eql(obj.nextSequence + 1);
    console.log(require('util').inspect(result, { depth: null }));
  });
})

/* ****************************Integrated Tests********************************** */
describe('printError()', () => {
  const options = {
    hostname: ip.address(),
    port: 7000,
    path: '/current',
  };

  before(() => {
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
  });

  it('should return XML Error', () => {
    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('NO_DEVICE');
      });
    });
  });
});


describe('printProbe()', () => {
  let stub;
  let stub1;
  let uuidCollection = ['000'];
  before(() => {
    stub = sinon.stub(lokijs, 'searchDeviceSchema');
    stub.returns([schema]);
    stub1 = sinon.stub(common, 'getAllDeviceUuids')
    stub1.returns(uuidCollection);
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    stub1.restore();
    stub.restore();
  });

  it('should return probe response', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/probe',
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let dataItem = child.children[1].children;

        expect(root.name).to.eql('MTConnectDevices');
        expect(child.name).to.eql('Device');
        expect(child.attributes).to.eql(attributes);
        expect(dataItem[0].name).to.eql('dataItem');
      });
    });
  });
});

describe('printCurrent()', () => {
  let stub;
  let stub1;
  let stub2;
  let stub3;

  const options = {
    hostname: ip.address(),
    port: 7000,
    path: '/current',
  };

  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    shdr.insert({ sequenceId: 0, id: 'avail', uuid: '000', time: '2',
                 value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 1, id:'estop', uuid: '000', time: '2',
                 value: 'TRIGGERED' });
    stub = sinon.stub(lokijs, 'searchDeviceSchema');
    stub.returns([schema]);
    stub1 = sinon.stub(lokijs, 'getDataItem');
    stub1.returns(dataItemsArr);
    stub2 = sinon.stub(dataStorage, 'categoriseDataItem');
    stub2.returns(dataItemWithVal);
    stub3 = sinon.stub(common, 'getAllDeviceUuids');
    stub3.returns(uuidCollection);
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    stub3.restore();
    stub2.restore();
    stub1.restore();
    stub.restore();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    shdr.clear();
  });

  it('should return the XML current response', () => {
    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let nameEvent = child.children[0].children[0].name;
        let avail = child.children[0].children[0].children[0];
        let estop = child.children[0].children[0].children[1];

        expect(root.name).to.eql('MTConnectStreams');
        expect(child.name).to.eql('DeviceStream');
        expect(child.attributes).to.eql(attributes);
        expect(nameEvent).to.eql('Events')
        expect(avail.name).to.eql('Availability');
        expect(avail.content).to.eql('AVAILABLE');
        expect(estop.name).to.eql('EmergencyStop');
        expect(estop.content).to.eql('TRIGGERED');
      });
    });
  });
});


describe('printCurrentAt()', () => {
  let stub;
  let stub1;
  let stub2;
  let stub3;
  const options = {
    hostname: ip.address(),
    port: 7000,
    path: '/current?at=1',
  };

  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    shdr.insert({ sequenceId: 1, id: 'avail', uuid: '000', time: '2',
                 value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 2, id:'estop', uuid: '000', time: '2',
                 value: 'TRIGGERED' });
    stub = sinon.stub(lokijs, 'searchDeviceSchema');
    stub.returns([schema]);
    stub1 = sinon.stub(lokijs, 'getDataItem');
    stub1.returns(dataItemsArr);
    stub2 = sinon.stub(dataStorage, 'categoriseDataItem');
    stub2.returns(dataItemWithVal);
    stub3 = sinon.stub(common, 'getAllDeviceUuids');
    stub3.returns(uuidCollection);
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    stub.restore();
    stub3.restore();
    stub2.restore();
    stub1.restore();
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
  });

  it('should return the XML current at response when requested sequenceId is within the first and last Sequence ', () => {
    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let nameEvent = child.children[0].children[0].name;
        let avail = child.children[0].children[0].children[0];
        let estop = child.children[0].children[0].children[1];

        expect(root.name).to.eql('MTConnectStreams');
        expect(child.name).to.eql('DeviceStream');
        expect(child.attributes).to.eql(attributes);
        expect(nameEvent).to.eql('Events')
        expect(avail.name).to.eql('Availability');
        expect(avail.content).to.eql('AVAILABLE');
        expect(estop.name).to.eql('EmergencyStop');
        expect(estop.content).to.eql('TRIGGERED');
      });
    });
  });
});


describe('printCurrentAt(), when at is out of range', () => {
  let stub;

  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    stub = sinon.stub(common, 'getAllDeviceUuids');
    stub.returns(uuidCollection);
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    stub.restore();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    shdr.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
  });

  it('gives ERROR response', () => {
    const sequence = dataStorage.getSequence();
    const lastSequence = sequence.lastSequence;
    const reqVal = lastSequence + 1;
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/current?at=${reqVal}`
    };
    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('OUT_OF_RANGE');
        expect(content).to.eql(`\'at\' must be less than or equal to ${lastSequence}.`);
      });
    });
  });
});

describe('current?path', () => {
  let stub;

  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    stub = sinon.stub(common, 'getAllDeviceUuids');
    stub.returns(uuidCollection);
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    stub.restore();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    shdr.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
  });

  it('gets the current response for the dataItems in the specified path', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/current?path=//Axes//Linear//DataItem[@subType="ACTUAL"]',
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);

        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0].children;
        let child1 = child[0].children[0].children[0];
        let child2 = child[1].children[0].children[0];
        let child3 = child[2].children[0].children[0];

        expect(child.length).to.eql(3);
        expect(child1.attributes.dataItemId).to.eql('x2');
        expect(child2.attributes.dataItemId).to.eql('y2');
        expect(child3.attributes.dataItemId).to.eql('z2');
      });
    });
  });

  it('current?path=&at= gives the current response at sequence number provided `\ at= \`', () => {
    const getSequence = dataStorage.getSequence();
    const seqNumber = getSequence.firstSequence + 1;
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/current?path=//Axes//Linear//DataItem[@subType="ACTUAL"]&at=${seqNumber}`,
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0].children;
        let child1 = child[0].children[0].children[0];
        let child2 = child[1].children[0].children[0];
        let child3 = child[2].children[0].children[0];

        expect(child.length).to.eql(3);
        expect(child1.attributes.dataItemId).to.eql('x2');
        expect(child2.attributes.dataItemId).to.eql('y2');
        expect(child3.attributes.dataItemId).to.eql('z2');
      });
    });
  });
});

describe('currentAtOutOfRange() gives the following errors ', () => {
  let stub;
  let stub1;
  let stub2;
  let stub3;

  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    shdr.insert({ sequenceId: 1, id: 'avail', uuid: '000', time: '2',
                 value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 2, id:'estop', uuid: '000', time: '2',
                 value: 'TRIGGERED' });
    shdr.insert({ sequenceId: 3, id: 'id1', uuid: '000', time: '2',
                 dataItemName: 'avail', value: 'CHECK1' });
    shdr.insert({ sequenceId: 4, id: 'id2', uuid: '000', time: '2',
                 dataItemName: 'avail', value: 'CHECK2' });
    shdr.insert({ sequenceId: 5, id: 'id3', uuid: '000', time: '2',
                 dataItemName: 'avail', value: 'CHECK3' });
    shdr.insert({ sequenceId: 6, id: 'id4', uuid: '000', time: '2',
                 dataItemName: 'avail', value: 'CHECK4' });
    shdr.insert({ sequenceId: 7, id: 'id5', uuid: '000', time: '2',
                 dataItemName: 'avail', value: 'CHECK5' });
    shdr.insert({ sequenceId: 8, id: 'id6', uuid: '000', time: '2',
                 dataItemName: 'avail', value: 'CHECK6' });
    shdr.insert({ sequenceId: 9, id: 'id7', uuid: '000', time: '2',
                 dataItemName: 'avail', value: 'CHECK7' });
    shdr.insert({ sequenceId: 10, id: 'id8', uuid: '000', time: '2',
                 dataItemName: 'avail', value: 'CHECK8' });
    shdr.insert({ sequenceId: 11, id: 'id9', uuid: '000', time: '2',
                 dataItemName: 'avail', value: 'CHECK9' });
    stub = sinon.stub(lokijs, 'searchDeviceSchema');
    stub.returns([schema]);
    stub1 = sinon.stub(lokijs, 'getDataItem');
    stub1.returns(dataItemsArr);
    stub2 = sinon.stub(dataStorage, 'categoriseDataItem');
    stub2.returns('ERROR');
    stub3 = sinon.stub(common, 'getAllDeviceUuids');
    stub3.returns(uuidCollection);
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    stub3.restore()
    stub2.restore();
    stub1.restore();
    stub.restore();
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
  });

  it('\'at must be positive integer\' when at value is negative', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/current?at=-10',
    };
    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;
        let detail = inspect(obj, {colors: true, depth: Infinity});

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('OUT_OF_RANGE');
        expect(content).to.eql('\'at\' must be a positive integer.');
      });
    });
  });

  it('\'at must be greater than or equal to firstSequenceId\' when at value is lesser than the range', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/current?at=1',
    };
    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;
        let detail = inspect(obj, {colors: true, depth: Infinity});

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('OUT_OF_RANGE');
        expect(content).to.eql('\'at\' must be greater than or equal to 2.');
      });
    });
  });

  it('\'at must be less than or equal to lastsequenceId\' when at value is greater than the range', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/current?at=100',
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('OUT_OF_RANGE');
        expect(content).to.eql('\'at\' must be less than or equal to 11.');
      });
    });
  });
});


describe('printSample(), request /sample is given', () => {
  let stub;
  let stub1;
  let stub2;
  let stub3;

  before(() => {
    stub = sinon.stub(lokijs, 'searchDeviceSchema');
    stub.returns([schema]);
    stub1 = sinon.stub(lokijs, 'getDataItem');
    stub1.returns(dataItemsArr);
    stub2 = sinon.stub(dataStorage, 'categoriseDataItem');
    stub2.returns(dataItemForSample);
    stub3 = sinon.stub(common, 'getAllDeviceUuids');
    stub3.returns(uuidCollection);
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    shdr.insert({ sequenceId: 1, id: 'avail', uuid: '000', time: '2',
                 value: 'AVAILABLE' });
    shdr.insert({ sequenceId: 2, id:'estop', uuid: '000', time: '2',
                  value: 'TRIGGERED' });

    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    shdr.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    stub3.restore();
    stub2.restore();
    stub1.restore();
    stub.restore();
  });

  it('without path or from & count it should give first 100 dataItems in the queue as response', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample',
    };

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let nameEvent = child.children[0].children[0].name;
        let avail = child.children[0].children[0].children[0];
        let estop = child.children[0].children[0].children[9];

        expect(root.name).to.eql('MTConnectStreams');
        expect(child.name).to.eql('DeviceStream');
        expect(child.attributes).to.eql(attributes);
        expect(nameEvent).to.eql('Events')
        expect(avail.name).to.eql('Availability');
        expect(avail.content).to.eql('UNAVAILABLE');
        expect(estop.name).to.eql('EmergencyStop');
        expect(estop.content).to.eql('TRIGGERED');
      });
    });
  });


  it('with from & count', () => {
    stub2.returns(dataItemForCount);
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?from=1&count=2',
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);

        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let nameEvent = child.children[0].children[0].name;
        let avail = child.children[0].children[0].children[0];
        let estop = child.children[0].children[0].children[1];

        expect(root.name).to.eql('MTConnectStreams');
        expect(child.name).to.eql('DeviceStream');
        expect(child.attributes).to.eql(attributes);
        expect(nameEvent).to.eql('Events')
        expect(avail.name).to.eql('Availability');
        expect(avail.content).to.eql('UNAVAILABLE');
        expect(estop.name).to.eql('EmergencyStop');
        expect(estop.content).to.eql('ARMED');
      });
    });
  });
});

describe('Test bad Count', () => {
  let stub1;
  let stub2;
  before(() => {
    ag.startAgent();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    shdr.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    stub1 = sinon.stub(lokijs, 'getDataItem');
    stub1.returns(dataItemsArr);
    stub2 = sinon.stub(common, 'getAllDeviceUuids');
    stub2.returns(['000']);
  });

  after(() => {
    ag.stopAgent();
    stub2.restore();
    stub1.restore();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    shdr.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
  });

  it('when the count is 0', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/sample?from=1&count=0`,
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('OUT_OF_RANGE');
        expect(content).to.eql(`\'count\' must be greater than or equal to 1.`);
      });
    });
  });

  it('when the count is non integer', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?from=1&count=1.98',
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('OUT_OF_RANGE');
        expect(content).to.eql('\'count\' must be a positive integer.');
      });
    });
  });


  it('when the count is negative', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?from=1&count=-2',
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('OUT_OF_RANGE');
        expect(content).to.eql('\'count\' must be a positive integer.');
      });
    });
  });

  it('when the count is larger than buffer size', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?from=1&count=1001',
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('OUT_OF_RANGE');
        expect(content).to.eql(`\'count\' must be less than or equal to 10.`);
      });
    });
  });
});


describe('sample?path=', () => {
  let stub;
  let sequence;

  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    sequence = dataStorage.getSequence();
    const seq1 = sequence.lastSequence + 1;
    const seq2 = seq1 + 1;
    shdr.insert({ sequenceId: `${seq1}`, id: 'hlow', uuid: '000', time: '2',
                 value: 'AVAILABLE',
                 path: '//Devices//Device[@name="VMC-3Axis"]//Systems//Hydraulic//DataItem[@type="LEVEL"]', });
    shdr.insert({ sequenceId: `${seq2}`, id:'htemp', uuid: '000', time: '2',
                 value: 'UNAVAILABLE',
                 path: '//Devices//Device[@name="VMC-3Axis"]//Systems//Hydraulic//DataItem[@type="TEMPERATURE"]', });
    stub = sinon.stub(common, 'getAllDeviceUuids');
    stub.returns(uuidCollection);
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    stub.restore();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    shdr.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
  });

  it('gives dataItems in the specified path for default count 100', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic',
    };

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0].children[0].children[0].children
        expect(child.length).to.eql(5);
        expect(child[0].attributes.dataItemId).to.eql('hlow');
        expect(child[1].attributes.dataItemId).to.eql('hlow');
        expect(child[2].attributes.dataItemId).to.eql('hpres');
        expect(child[3].attributes.dataItemId).to.eql('htemp');
        expect(child[4].attributes.dataItemId).to.eql('htemp');
      });
    });
  });

  it('with path and from&count', () => {
    const lastSequence = sequence.lastSequence;
    const value = lastSequence - 5;
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic&from=${value}&count=5`,
    };

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0].children[0].children[0].children
        expect(child.length).to.eql(2);
        expect(child[0].attributes.dataItemId).to.eql('hlow');
        expect(child[1].attributes.dataItemId).to.eql('hpres');
      });
    });
  });

  it('with path and from+count > lastsequence', () => {
    const lastSequence = sequence.lastSequence + 2;
    const value = lastSequence;
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic&from=${value}&count=5`,
    };

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0].children[0].children[0].children
        expect(child.length).to.eql(1);
        expect(child[0].attributes.dataItemId).to.eql('htemp');
      });
    });
  });
});


describe('ipaddress:port/devicename/', () => {

  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    shdr.clear();
  });

  describe('give the requested response for the given deviceName', () => {
    it('if present', () => {
      const options = {
        hostname: ip.address(),
        port: 7000,
        path: '/VMC-3Axis/current?path=//Device[@name="VMC-3Axis"]',
      };

      http.get(options, (res) => {
        res.on('data', (chunk) => {
          const xml = String(chunk);
          let obj = parse(xml);
          let root = obj.root;
          let name = root.children[1].children[0].attributes.name;
          expect(name).to.eql('VMC-3Axis');
        });
      });
    });

    it('if absent, will send NO_DEVICE error as xml', () => {
      const options = {
        hostname: ip.address(),
        port: 7000,
        path: '/VMC-3Axis-1/current?path=//Device[@name="VMC-3Axis"]',
      };

      http.get(options, (res) => {
        res.on('data', (chunk) => {
          const xml = String(chunk);
          let obj = parse(xml);
          let root = obj.root;
          let child = root.children[1].children[0];
          let errorCode = child.attributes.errorCode;
          let content = child.content;
          let expectedContent = 'Could not find the device VMC-3Axis-1.'
          expect(root.name).to.eql('MTConnectError');
          expect(errorCode).to.eql('NO_DEVICE');
          expect(content).to.eql(expectedContent);
        });
      });
    });
  });
});


describe('badPath and badXPath', () => {
  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    shdr.clear();
  });
  it('gives UNSUPPORTED path error when path is too long', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/VMC-3Axis/garbage/current?path=//Device[@name="VMC-3Axis"]',
    };

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let name = root.name;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;
        let expectedContent = `The following path is invalid: ${options.path}.`;
        expect(name).to.eql('MTConnectError');
        expect(errorCode).to.eql('UNSUPPORTED');
        expect(content).to.eql(expectedContent);
      });
    });
  });
  it('gives INVALID_XPATH error when path is not present', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/VMC-3Axis/current?path=//"AXES"',
    };

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let name = root.name;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;
        let expectedContent = `The path could not be parsed. Invalid syntax: //"AXES".`;
        expect(name).to.eql('MTConnectError');
        expect(errorCode).to.eql('INVALID_XPATH');
        expect(content).to.eql(expectedContent);
      });
    });
  });
})


describe('When a request does not contain current, sample or probe', () => {
  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    shdr.clear();
  });
  it('gives UNSUPPORTED error', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/VMC-3Axis/garbage/check?path=//Device[@name="VMC-3Axis"]',
    };

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let name = root.name;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;
        let expectedContent = `The following path is invalid: ${options.path}.`;
        expect(name).to.eql('MTConnectError');
        expect(errorCode).to.eql('UNSUPPORTED');
        expect(content).to.eql(expectedContent);
      });
    });
  });
});

describe('emptyStream', () => {
  let stub;

  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    stub = sinon.stub(common, 'getAllDeviceUuids');
    stub.returns(uuidCollection);
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    stub.restore();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    shdr.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
  });
  it('gives an empty MTConnectStreams without any dataItems', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?path=//Axes',
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);

        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        expect(root.name).to.eql('MTConnectStreams');
        expect(child.name).to.eql('DeviceStream');
        expect(child.attributes).to.eql(attributes);
        expect(child.children).to.eql([]);
      });
    });
  });
});

describe('invalid from value', () => {

  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    stub = sinon.stub(common, 'getAllDeviceUuids');
    stub.returns(uuidCollection);
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    stub.restore();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    shdr.clear();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
  });

  it('from = non integer value, OUT_OF_RANGE error: from must be a positive integer', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?from=abc',
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('OUT_OF_RANGE');
        expect(content).to.eql('\'from\' must be a positive integer.');
      });
    });
  });

  it('from < 0, OUT_OF_RANGE error: from must be a positive integer', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?from=-1',
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('OUT_OF_RANGE');
        expect(content).to.eql('\'from\' must be a positive integer.');
      });
    });
  });

  it('from < firstSequenceId, OUT_OF_RANGE error: from must be greater than or equal to firstSequence ', () => {
    let sequence = dataStorage.getSequence();
    let firstSequence = sequence.firstSequence;
    let reqSeq = firstSequence - 1;
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/sample?from=${reqSeq}`,
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('OUT_OF_RANGE');
        expect(content).to.eql(`\'from\' must be greater than or equal to ${firstSequence}.`);
      });
    });
  });

  it('from > lastsequenceId, OUT_OF_RANGE error: from must be less than or equal to lastSequence ', () => {
    let sequence = dataStorage.getSequence();
    let lastSequence = sequence.lastSequence;
    let reqSeq = lastSequence + 1;
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/sample?from=${reqSeq}`,
    };

    http.get(options,(res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0];
        let errorCode = child.attributes.errorCode;
        let content = child.content;

        expect(root.name).to.eql('MTConnectError');
        expect(errorCode).to.eql('OUT_OF_RANGE');
        expect(content).to.eql(`\'from\' must be less than or equal to ${lastSequence}.`);
      });
    });
  });
});

// TODO : change the test to conditions with native Code
describe('Condition()', () => {
  const shdrString1 = '2010-09-29T23:59:33.460470Z|htemp|WARNING|HTEMP|1|HIGH|Oil Temperature High';
  before(() => {
    shdr.clear();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    const parsedInput = common.inputParsing(shdrString1, '000');
    lokijs.dataCollectionUpdate(parsedInput, '000');
    ag.startAgent();
  });

  after(() => {
    ag.stopAgent();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    cbPtr.fill(null).empty();
    schemaPtr.clear();
    shdr.clear();
  });

  it('gives the status of a device - NORMAL, FAULT, UNAVAILABLE, WARNING', () => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/VMC-3Axis/current?path=//Device[@name="VMC-3Axis"]//Hydraulic',
    };

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk);
        let obj = parse(xml);
        let root = obj.root;
        let child = root.children[1].children[0].children[0].children;
        let lastChild = child[0].children[2];
        let attributes = lastChild.attributes;
        expect(child[0].name).to.eql('Condition');
        expect(lastChild.name).to.eql('Warning');
        expect(attributes.nativeCode).to.eql('HTEMP');
        expect(attributes.nativeSeverity).to.eql('1');
        expect(attributes.qualifier).to.eql('HIGH');
        expect(lastChild.content).to.eql('Oil Temperature High');
      });
    });

  });
});

describe.skip('veryLargeSequence()', () => {
  it('', () => {
  });
});

describe.skip('statisticAndTimeSeriesProbe()', () => {
  it('', () => {
  });
});

describe.skip('timeSeries()', () => {
  it('', () => {
  });
});

describe.skip('nonPrintableCharacters()', () => {
  it('', () => {
  });
});

describe.skip('printAsset()', () => {
  it('', () => {
  });
});

describe.skip('printAssetProbe()', () => {
  it('', () => {
  });
});

describe.skip('printCuttingTool()', () => {
  it('', () => {
  });
});
