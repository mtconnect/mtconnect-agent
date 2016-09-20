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

// Imports - Internal

const log = require('../src/config/logger');
const common = require('../src/common');
const dataStorage = require('../src/dataStorage');
const lokijs = require('../src/lokijs');

// constants
const cbPtr = dataStorage.circularBuffer;
const schemaPtr = lokijs.getSchemaDB();
const rawData = lokijs.getRawDataDB();
const uuid = '000';
const shdrString2 = '2014-08-13T07:38:27.663Z|execution|UNAVAILABLE|line|' +
                  'UNAVAILABLE|mode|UNAVAILABLE|' +
                  'program|UNAVAILABLE|Fovr|UNAVAILABLE|Sovr|UNAVAILABLE|' +
                  'sub_prog|UNAVAILABLE|path_pos|UNAVAILABLE';
const shdrString1 = '2014-08-11T08:32:54.028533Z|avail|AVAILABLE';
const shdrString3 = '2016-04-12T20:27:01.0530|logic1|NORMAL||||';

const result1 = { time: '2014-08-11T08:32:54.028533Z',
dataitem: [{ name: 'avail', value: 'AVAILABLE' }] };

const result2 = { time: '2014-08-13T07:38:27.663Z',
  dataitem:
   [{ name: 'execution', value: 'UNAVAILABLE' },
     { name: 'line', value: 'UNAVAILABLE' },
     { name: 'mode', value: 'UNAVAILABLE' },
     { name: 'program', value: 'UNAVAILABLE' },
     { name: 'Fovr', value: 'UNAVAILABLE' },
     { name: 'Sovr', value: 'UNAVAILABLE' },
     { name: 'sub_prog', value: 'UNAVAILABLE' },
     { name: 'path_pos', value: 'UNAVAILABLE' }] };

const result3 = { time: '2016-04-12T20:27:01.0530',
  dataitem: [{ name: 'logic1', value: 'NORMAL' }] };

// Tests


describe('On receiving data from adapter', () => {
  describe('inputParsing()', () => {
    it('parses shdr with single dataitem correctly', () =>
      expect(common.inputParsing(shdrString1)).to.eql(result1)
    );
    it('parses shdr with multiple dataitem correctly', () =>
      expect(common.inputParsing(shdrString2)).to.eql(result2)
    );
    it('parses shdr with single dataitem and empty pipes correctly', () =>
      expect(common.inputParsing(shdrString3)).to.eql(result3)
    );
  });
});

describe('For every Device', () => {
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
      expect(common.getDeviceUuid('VMC-3Axis')).to.eql(uuid)
    });

    it('gives undefined if not present', () => {
      expect(common.getDeviceUuid('VMC-3Axis-1')).to.eql(undefined)
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
  it('returns true if valid', () => {
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    let result = common.pathValidation('//DataItem[@type="AVAILABILITY"]', ['000'])
    expect(result).to.eql(true);
  })

  it('returns false if not valid', () => {
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8');
    lokijs.insertSchemaToDB(JSON.parse(jsonFile));
    let result = common.pathValidation('//Axes', ['000'])
    expect(result).to.eql(false);
  })
})


describe('getCurrentTimeInSec()', () => {  
  it('gives the presnt time in seconds', (done) => {
     let time1 = common.getCurrentTimeInSec();
     let time2;
     setTimeout(() => {
       time2 = common.getCurrentTimeInSec();
       let timediff = time2 - time1
       expect(timediff).to.eql(1);
       done();
     }, 1000);
  })
})
