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

const assert = require('assert');
const expect = require('expect.js');
const sinon = require('sinon');
const ip = require('ip');
const path = require('path');
const fs = require('fs');
const env = process.env;
const moment = require('moment');
const http = require('http');

// Imports - Internal

const log = require('../src/config/logger');
const ad = require('../src/adapter.js');
const supertest = require('supertest');
const ag = require('../src/main');
const common = require('../src/common');
const lokijs = require('../src/lokijs');

describe('startAgent', function() {
  let spy;
  const machinePort = 7879;

  before(function() {
    spy = sinon.spy(log, 'info');
    ag.startAgent();
    ad.startFileServer(8080);
    ad.startSimulator(machinePort, ip.address());
  });

  after(function() {
    ad.stopSimulator();
    ad.stopFileServer();
    ag.stopAgent();
    log.info.restore();
  });

  it('should start and stop agent successfully', function(done) {
    this.timeout(2000);

    setTimeout(function() {
      expect(spy.callCount).to.be.equal(2);
      done();
    }, 1000)
  });
});

describe('searchDevices', function() {
  it('should run successfully', function(done) {
    this.timeout(12000);

    ag.searchDevices();

    setTimeout(function() {
      done();
    }, 10000);
  });
});

describe('getDeviceXML', function() {
  let spy;

  before(() => {
    spy = sinon.spy(http, 'get');

    ad.startFileServer(8080);
  });

  after(() => {
    ad.stopFileServer();

    http.get.restore();
  });

  it('should run successfully', function() {
    ag.getDeviceXML('localhost', 7879, 8080, '000');

    expect(spy.callCount).to.be.equal(1);
  });
});

describe('processSHDR', () => {
  let save1;
  let save2;
  let spy;

  before(() => {
    save = sinon.stub(common, 'inputParsing');
    save2 = sinon.stub(lokijs, 'dataCollectionUpdate');
    spy = sinon.spy(log, 'debug');

    ag.processSHDR('2014-08-11T08:32:54.028533Z|avail|AVAILABLE', '000');
  });

  after(() => {
    log.debug.restore();

    save2.restore();
    save.restore();
  })

  it('should succeed', () => {
    expect(spy.callCount).to.be.above(0);
  })
});

describe.skip('badFreq', () => {
  it('', () => {
  });
});

describe.skip('badDevices', () => {
  it('', () => {
  });
});

describe('addAdapter()', () => {
  let spy;
  const machinePort = 8003;

  before(() => {
    spy = sinon.spy(log, 'info');
    ad.startSimulator(machinePort, ip.address());
  });

  after(() => {
    ad.stopSimulator();
    log.info.restore();
  });

  it('should start the adapter successfully', () => {
    expect(spy.callCount).to.be.equal(1);
  });
});

describe.skip('sampleAtNextSeq()', () => {
  it('', () => {
  });
});

describe.skip('sequenceNumberRollOver()', () => {
  it('', () => {
  });
});

describe('xsdFileDownload()', () => {
  let schemaString;
  const schemaPath = `../schema/MTConnectDevices_1.1.xsd`;
  const schemaFile = path.join(__dirname, schemaPath);

  before(() => {
    try {
      schemaString = fs.readFileSync(schemaFile, 'utf8');
    } catch (e) {
      console.log('Error reading file:', 'MTConnectDevices_1.1.xsd', e);
    }
  })

  it('should download a schema file', () => {
    expect(schemaString).to.contain('urn:mtconnect.org:MTConnectDevices:1.1');
  });
});

describe('xsdFailedFileDownload()', () => {
  let schemaString;
  const schemaPath = `../schema/MTConnectDevices_unknown.xsd`;
  const schemaFile = path.join(__dirname, schemaPath);

  before(() => {
    try {
      schemaString = fs.readFileSync(schemaFile, 'utf8');
    } catch (e) {
      console.log('Error reading file:', 'MTConnectDevices_unknown.xsd', e);
    }
  })

  it('should throw error for unknown schema file', () => {
    expect(schemaString).to.be.empty;
  });
});


describe('getAdapterinfo', () => {
  let result;
  const headers = { ST: 'urn:schemas-mtconnect-org:service:VMC-*',
                    USN: '000::urn:schemas-mtconnect-org:service:VMC-*',
                    LOCATION: '10.0.0.1:7879:8080',
                    'CACHE-CONTROL': 'max-age=1800',
                    DATE: 'Thu, 29 Sep 2016 11:59:10 GMT',
                    SERVER: 'node.js/6.2.0 UPnP/1.1 node-ssdp/2.7.1',
                    EXT: '' }

  before(() => {
    result = ag.getAdapterInfo(headers);
  });

  it('should succeed', () => {
    expect(result.ip).to.be.equal('10.0.0.1');
    expect(result.port).to.be.equal('7879');
    expect(result.filePort).to.be.equal('8080');
    expect(result.uuid).to.be.equal('000');
  });
});

describe.skip('duplicateCheck()', () => {
  it('', () => {
  });
});

describe.skip('autoAvailable()', () => {
  it('', () => {
  });
});

describe.skip('multipleDisconnect()', () => {
  it('', () => {
  });
});

describe.skip('ignoreTimestamps()', () => {
  it('', () => {
  });
});

describe.skip('adapterAddAsset()', () => {
  it('', () => {
  });
});

describe.skip('multiLineAsset()', () => {
  it('', () => {
  });
});

describe.skip('assetProbe()', () => {
  it('', () => {
  });
});

describe.skip('assetStorageWithoutType()', () => {
  it('', () => {
  });
});

describe.skip('Put()', () => {
  it('', () => {
  });
});

describe.skip('putBlocking()', () => {
  it('', () => {
  });
});

describe.skip('putBlockingFrom()', () => {
  it('', () => {
  });
});

describe.skip('streamData()', () => {
  it('', () => {
  });
});


describe.skip('relativeTime()', () => {
  it('', () => {
  });
});

describe.skip('relativeParsedTime()', () => {
  it('', () => {
  });
});

describe.skip('relativeParsedTimeDetection()', () => {
  it('', () => {
  });
});

describe.skip('relativeOffsetDetection()', () => {
  it('', () => {
  });
});

describe.skip('dynamicCalibration()', () => {
  it('', () => {
  });
});

describe.skip('initialTimeSeriesValues()', () => {
  it('', () => {
  });
});
