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

// Imports - Internal

const log = require('../src/config/logger');
const ad = require('../src/adapter.js');
const supertest = require('supertest');
const ag = require('../src/main');

describe('setInterval', function() {
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
    ag.stopAgent();
    ad.stopFileServer();
    log.info.restore();
  });

  it('should run setInterval and exit successfully', function(done) {
    this.timeout(10000);

    setTimeout(function() {
      expect(spy.callCount).to.be.equal(2);
      done();
    }, env.VI_PING_INTERVAL)
  });
});


// describe('getInstanceId()', () => {
//   before(() => {
//     ag.startAgent();
//   });
//
//   after(() => {
//     ag.stopAgent();
//   });
//
//  it('gets the instanceId of the agent instance', () => {
//    let instanceId = ag.getInstanceId();
//    let timeNow = moment().unix(Number);
//    expect(instanceId).to.eql(timeNow);
//  })
// });



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

describe.skip('assetStorage()', () => {
  it('', () => {
  });
});

describe.skip('assetBuffer()', () => {
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

describe.skip('withDuplicateDeviceUUID()', () => {
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
