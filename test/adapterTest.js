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

// Imports - Internal

const adapter = require('../src/adapter.js');
const supertest = require('supertest');

describe('machineDataGenerator', () => {
  it('should return simulated values', () => {
    const machineData = adapter.machineDataGenerator();
    assert.equal(machineData.next().value, '2|avail|UNAVAILABLE');
  });
});


describe('fileServer', () => {
  const instance = adapter.fileServer.listen();

  before(() => {
    instance.on('listening', () => {
      console.log(`Started ... ${util.inspect(instance.address())}`);
    });
  });

  describe('/public', () => {
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

  after(() => {
    instance.close();
  });
});
