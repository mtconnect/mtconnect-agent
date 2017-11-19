/*
 * Copyright Copyright 2017, VIMANA, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

const expect = require('unexpected').clone();

let config;

describe('configuration', () => {
  before(() => {
    const nconf = require('nconf');
  
    nconf.remove('simulator1');
    nconf.remove('adapter_default');
    process.env.node_env = 'test';
    config = require('../src/configuration');
  });
  
  
  describe('configuration', () => {
    it('should have configured to match the simulator1 configuration', () => {
      expect(config.get('app:name'), 'to equal', 'mtconnect-agent');
      expect(config.get('app:agent:agentPort'), 'to equal', 5000);
      expect(config.get('app:agent:bufferSize'), 'to equal', 131072);
      expect(config.get('app:agent:assetBufferSize'), 'to equal', 1024);
    });
    
    it('should give logging configuration', () => {
      const logging = config.get('logging');
      expect(logging, 'to equal', {
        logLevel: 'debug',
        logDir: './log',
        name: 'mtconnect-agent',
        version: '1.4',
      });
    });
  });
});
