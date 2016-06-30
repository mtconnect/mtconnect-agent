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

// Imports - Internal

const log = require('../src/config/logger');
const common = require('../src/common');


// constants

const uuid = '000';
const shdrstring2 = '2014-08-13T07:38:27.663Z|execution|UNAVAILABLE|line|' +
                  'UNAVAILABLE|mode|UNAVAILABLE|' +
                  'program|UNAVAILABLE|Fovr|UNAVAILABLE|Sovr|UNAVAILABLE|' +
                  'sub_prog|UNAVAILABLE|path_pos|UNAVAILABLE';
const shdrstring1 = '2014-08-11T08:32:54.028533Z|avail|AVAILABLE';
const shdrstring3 = '2016-04-12T20:27:01.0530|logic1|NORMAL||||';

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
      expect(common.inputParsing(shdrstring1)).to.eql(result1)
    );
    it('parses shdr with multiple dataitem correctly', () =>
      expect(common.inputParsing(shdrstring2)).to.eql(result2)
    );
    it('parses shdr with single dataitem and empty pipes correctly', () =>
      expect(common.inputParsing(shdrstring3)).to.eql(result3)
    );
  });
});

describe('For every Device', () => {
  describe('getUuid()', () => {
    it('assigns unique uuid', () =>
      expect(common.getUuid()).to.eql(uuid)
    );
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
    });
    it('should log and exit', () => {
      save.yields(common.processError('Test', true));
      expect(spy.callCount).to.be.equal(1);
    });
  });
});
