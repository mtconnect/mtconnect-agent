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

// Imports - Internal

const supertest = require('supertest');
const dataStorage = require('../src/dataStorage');
const config = require('../src/config/config');

describe('simulatorConfig', () => {
  context('for uuid', () => {
    it('should return 000', () => {
      assert.equal('000', config.app.simulator.uuid);
    });
  });

  context('for machinePort', () => {
    it('should return 7879', () => {
      assert.equal(7879, config.app.simulator.machinePort);
    });
  });
  
  context('for maxDelay', () => {
    it('should return 3000', () => {
      assert.equal(3000, config.app.simulator.maxDelay);
    });
  });
});

describe('agentConfig', () => {
  context('for pingInterval', () => {
    it('should return 10000', () => {
      assert.equal(10000, config.app.agent.pingInterval);
    });
  });
  
  context('for deviceSearchInterval', () => {
    it('should return 3000', () => {
      assert.equal(3000, config.app.agent.deviceSearchInterval);
    });
  });

  context('for agentPort', () => {
    it('should return 7000', () => {
      assert.equal(7000, config.app.agent.agentPort);
    });
  });

  context('for filePort', () => {
    it('should return 8080', () => {
      assert.equal(8080, config.app.agent.filePort);
    });
  });

  context('for bufferSize', () => {
    it('should return 10', () => {
      assert.equal(10, dataStorage.bufferSize);
    });
  });
});
