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

const { Client } = require('node-ssdp');
const createFakeSocket = require('../helpers/ssdp-helper');
const dgram = require('dgram');
const sinon = require('sinon');

const expect = require('unexpected').clone()
  .use(require('unexpected-stream'))
  .use(require('unexpected-dom'));

// Default to using simulator 1 for these tests
process.env.name = 'simulator1';

describe('discovery', () => {
  let config;
  let adapter;
  
  before(() => {
    // Default to using simulator 1 for these tests
    const nconf = require('nconf');
    nconf.remove('default');
    nconf.remove('test');
    
    process.env.name = 'simulator1';
    
    // Imports - Internal
    config = require('../../adapters/src/config');
    adapter = require('../../adapters/src/adapter');
  
    this.sinon = sinon.sandbox.create();
    this.sinon.stub(dgram, 'createSocket').callsFake(createFakeSocket.bind(this));
  });
  
  after(() => {
    this.sinon.restore();
  });
  
  describe('discovery using UPnP', () => {
    let client;
    
    beforeEach('start adapter', function* setup() {
      adapter.start();
      client = new Client();
      client.start();
    });
    
    afterEach('stop adapter', () => {
      adapter.stop();
      client.stop();
    });
    
    /* Need to mock SSDP at the UPD level. Will leave this pending for now. Loopback of
       UDP packet will not work.
     */
    it('should be found using UPnP', function (done) {
      const lookup = 'urn:schemas-mtconnect-org:service:*';
      client.on('response', (headers) => {
        const {ST, LOCATION, USN} = headers;
        
        expect(ST, 'to equal', lookup);
        expect(LOCATION, 'to equal', `http://${config.get('app:address')}:${config.get('app:filePort')}/`);
        expect(USN, 'to equal', `uuid:${config.get('app:uuid')}::urn:schemas-mtconnect-org:service:*`);
        done();
      });
      client.search(lookup);
      
    });
  });
});
