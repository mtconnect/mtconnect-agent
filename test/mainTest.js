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
const parse = require('xml-parser');
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

const shdr = lokijs.getRawDataDB();
const schemaPtr = lokijs.getSchemaDB();

describe('processSHDR', () => {
  // let save1;
  // let save2;
  // let spy;

  // before(() => {
  //   save = sinon.stub(common, 'inputParsing');
  //   save2 = sinon.stub(lokijs, 'dataCollectionUpdate');
  //   spy = sinon.spy(log, 'debug');

  //   ag.processSHDR('2014-08-11T08:32:54.028533Z|avail|AVAILABLE', '000');
  // });

  // after(() => {
  //   log.debug.restore();

  //   save2.restore();
  //   save.restore();
  // });

  // it('should succeed', () => {
  //   expect(spy.callCount).to.be.above(0);
  // });
});


describe.skip('badDevices', () => {
  it('', () => {
  });
});

describe('addAdapter()', () => {

});

describe.skip('sampleAtNextSeq()', () => {
  it('', () => {
  });
});

describe.skip('sequenceNumberRollOver()', () => {
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

describe.skip('adapterAddAsset()', () => {
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


describe.skip('putBlocking()', () => {
  it('', () => {
  });
});

describe.skip('putBlockingFrom()', () => {
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
