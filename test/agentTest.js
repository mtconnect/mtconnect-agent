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

// Imports - Internal

const log = require('../src/config/logger');
const ad = require('../src/adapter.js');
const supertest = require('supertest');
const agent = require('../src/main');

describe('success', () => {
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

  it('should run successfully', () => {
    expect(spy.callCount).to.be.equal(1);
  });
});

describe.skip('badPath', () => {
  it('', () => {
  });
});

describe.skip('badXPath', () => {
  it('', () => {
  });
});

describe.skip('badCount', () => {
  it('', () => {
  });
});

describe.skip('badFreq', () => {
  it('', () => {
  });
});

describe.skip('goodPath', () => {
  it('', () => {
  });
});

describe.skip('emptyStream', () => {
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

describe.skip('xsdFileDownload()', () => {
  it('', () => {
  });
});

describe.skip('xsdFailedFileDownload()', () => {
  it('', () => {
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
