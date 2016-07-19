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
const util = require('util');
const chai = require('chai');
const expect  = chai.expect;
const fs = require('fs');
const http = require('http');

// const expect = require('expect.js');
const sinon = require('sinon');

// Imports - Internal

const log = require('../src/config/logger');
const adapter = require('../src/adapter.js');
const supertest = require('supertest');

// Helper functions

function* machineNoFileGenerator() {
  const inputFile = '/tmp/FileDoesNotExist';
  const data = fs.readFileSync(inputFile).toString().split(/['\n','\r']+/);
  yield* data[Symbol.iterator]();
}

describe('machineDataGenerator', () => {
  it('should return simulated values', () => {
    const machineData = adapter.machineDataGenerator();
    assert.equal(machineData.next().value, '2|avail|UNAVAILABLE'); // TODO: check /r
  });
});

describe('dataExists', () => {
  describe('success', () => {
    it('must return data', () => {
      const machineData = adapter.machineDataGenerator();

      assert.equal(adapter.dataExists(machineData), '2|avail|UNAVAILABLE');
    });
  });

  describe('ENOENT', () => {
    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'error');
    });

    after(() => {
      save.restore();
      log.error.restore();
    });

    it('must return \'Input file not found\'', () => {
      const machineData = machineNoFileGenerator();

      save.yields(adapter.dataExists(machineData));
      expect(spy.callCount).to.be.equal(1);
    });
  });

  describe('else error', () => {
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

    it('must return error', () => {
      const mData = null;

      save.yields(adapter.dataExists(mData));
      expect(spy.callCount).to.be.equal(1);
    });
  });
});

describe('fileServer', () => {
  describe('/public', () => {
    before(() => {
      adapter.startFileServer(8080);
    });

    after(() => {
      adapter.stopFileServer();
    });

    it('should return 200', (done) => {
      const request = supertest('http://localhost:8080');

      request
        .get('/VMC-3Axis.json')
        .expect(200, (err, res) => {
          if (res) {
            assert(res.statusCode, 200);
          } else if (err) {
            console.log('Error: ');
            console.log(util.inspect(err));
          }
          done();
        });
    });
  });

  describe('error', () => {
    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'error');

      adapter.startFileServer(22);
    });

    after(() => {
      adapter.stopFileServer();

      log.error.restore();
      save.restore();
    });

    it('must return error', () => {
      expect(spy.callCount).to.be.equal(1);
    });
  });
});
