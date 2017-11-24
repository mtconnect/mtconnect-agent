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

const mockery = require('mockery');
const expect = require('unexpected').clone()
  .use(require('unexpected-stream'))
  .use(require('unexpected-dom'));
const sinon = require('sinon');
const net = require('net');
const EventEmitter = require('events');


describe('Shdr Adapter Input', () => {
  let ShdrManager;
  
  before(() => {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true,
    });

    ShdrManager = require('../../src/input/shdr');
  });
  
  after(() => mockery.disable());
  
  class MockSocket extends EventEmitter {
    constructor(address, port) {
      super();
      this.address = address;
      this.port = port;
    }
  }
  
  let stubCreate;
  let mockSocket;
  beforeEach('Mock Socket', () => {
    stubCreate = sinon.stub(net, 'createConnection').callsFake((address, port) => {
      mockSocket = new MockSocket(address, port);
      return mockSocket;
    });
  });
  
  afterEach(() => {
    stubCreate.restore();
    mockSocket = undefined;
  });
  
  describe('shdr manager', () => {
    it('should have the manager call connect on the adapter and call createConnection', () => {
      const manager = new ShdrManager({});
      const con = manager.connectTo('shdr://127.0.0.1:7878', '1234');
      mockSocket.emit('connect', {});
    
      expect(stubCreate.args[0][0], 'to equal', '7878');
      expect(stubCreate.args[0][1], 'to equal', '127.0.0.1');
    });
  });
  
  describe('shdr connection', () => {
    let manager;
    beforeEach(() => {
      manager = new ShdrManager({});
    })
    
    it('should connect to adapter', (done) => {
      const Shdr = ShdrManager.ShdrConnection;
      const shdr = new Shdr('127.0.0.1', '7878', '12345')
      shdr.connect()
        .then((s) => {
          expect(stubCreate.args[0][0], 'to equal', '7878');
          expect(stubCreate.args[0][1], 'to equal', '127.0.0.1');
          done();
        });
      mockSocket.emit('connect', {});
    });
  
    it('should timeout connect after connectTimeout', (done) => {
      const Shdr = ShdrManager.ShdrConnection;
      const shdr = new Shdr('127.0.0.1', '7878', '12345', { connectTimeout: 100 })
      shdr.connect()
        .then((s) => {
          expect(s, 'to be undefined');
          done();
        })
        .catch((err) => {
          expect(err, 'to equal', 'Could not connect to 127.0.0.1:7878 timed out after 100ms')
          done();
        });
    });
  
    it('should receive lines of data from the adapter');
    it('should heartbeat the adapter');
    it('should disconnect if the adapter does not respond to heartbeat or send data');
    it('should decode the line of data using the device manager');
    it('should decode single line asset data');
    it('should decode multi-line asset data');
    it('should emit data events with the line of data decoded');
    it('should handle multiple key/value pairs on a single line');
    it('should handle time-series data');
    it('should handle messages');
    it('should handle legacy alarms');
    it('should handle conditions');
  });
});