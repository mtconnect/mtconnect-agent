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

const rl = require('readline');
const request = require('co-request');
const net = require('net');

const jsdom = require('jsdom');
const { JSDOM } = jsdom;

// SSDP Client – Refactor to discovery

const expect = require('unexpected').clone()
  .use(require('unexpected-stream'))
  .use(require('unexpected-dom'));

let config,
  device,
  fileServer;

function* getLine(stream) {
  stream.resume();
  
  return new Promise((resolve, reject) => {
    stream.on('line', (line) => {
      resolve(line);
      stream.pause();
      stream.removeAllListeners();
    });
    
    stream.on('end', (err) => {
      resolve(null);
      stream.removeAllListeners();
    });
    
    stream.on('error', (err) => {
      reject(err);
      stream.removeAllListeners();
    });
  });
}

describe('simulator', () => {
  before(() => {
    // Default to using simulator 1 for these tests
    const nconf = require('nconf');
    nconf.remove('default');
    nconf.remove('test');
    
    process.env.name = 'simulator1';
    process.env.app__address = '127.0.0.1';

    // Imports - Internal
    config = require('../../adapters/src/config');
    device = require('../../adapters/src/device');
    fileServer = require('../../adapters/src/file_server');
  });
  
  describe('configuration', () => {
    it('should have configured to match the simulator1 configuration', () => {
      expect(config.get('app:name'), 'to equal', 'Simulator_1');
      expect(config.get('app:machinePort'), 'to equal', 7878);
      expect(config.get('app:filePort'), 'to equal', 8080);
      expect(config.get('app:address'), 'to equal', '127.0.0.1');
    });
  });
  
  describe('fileServer', () => {
    let listener;
    
    beforeEach('setup file server', () => {
      listener = fileServer.listen(config.get('app:filePort'), '127.0.0.1');
    });
    
    afterEach('close file server', () => listener.close());
    
    describe('UPnP description', () => {
      it('should provide an XML response', function* xml() {
        const res = yield request(`http://127.0.0.1:${config.get('app:filePort')}`);
        expect(res.statusCode, 'to equal', 200);
        expect(res.headers['content-type'], 'to equal', 'application/xml');
      });
      
      it('should have a base URL set to the current address', function* xml() {
        const res = yield request(`http://127.0.0.1:${config.get('app:filePort')}`);
        expect(res.statusCode, 'to equal', 200);
        let dom = new JSDOM(res.body, {contentType: 'text/xml'}).window.document;
        const root = dom.children[0];
        expect(root.localName, 'to equal', 'root');
        expect(root, 'to have child', 'URLBase');
        expect(root, 'queried for', 'URLBase', 'to have items satisfying',
          'to have text', `http://127.0.0.1:${config.get('app:filePort')}`);
        expect(root, 'queried for', 'UDN', 'to have items satisfying',
          'to have text', `uuid:${config.get('app:uuid')}`);
      });
    });
    
    describe('MTConnect probe', () => {
      it('should provide an XML response', function* xml() {
        const res = yield request(`http://127.0.0.1:${config.get('app:filePort')}/probe`);
        expect(res.statusCode, 'to equal', 200);
        expect(res.headers['content-type'], 'to equal', 'application/xml');
      });
      
      it('should have an MTConnect devices document', function* xml() {
        const res = yield request(`http://127.0.0.1:${config.get('app:filePort')}/probe`);
        expect(res.statusCode, 'to equal', 200);
        
        let dom = new JSDOM(res.body, {contentType: 'text/xml'}).window.document;
        const root = dom.children[0];
        expect(root.localName, 'to equal', 'MTConnectDevices');
      });
      
      it('should have return a device named Mazak01', function* xml() {
        const res = yield request(`http://127.0.0.1:${config.get('app:filePort')}/probe`);
        expect(res.statusCode, 'to equal', 200);
        
        let dom = new JSDOM(res.body, {contentType: 'text/xml'}).window.document;
        const root = dom.children[0];
        expect(root, 'queried for', 'Device', 'to have items satisfying',
          'to have attributes', {name: 'Mazak01', uuid: config.get('app:uuid')});
      });
      
      it('should add a data tag to the device description', function* xml() {
        const res = yield request(`http://127.0.0.1:${config.get('app:filePort')}/probe`);
        expect(res.statusCode, 'to equal', 200);
        
        let dom = new JSDOM(res.body, {contentType: 'text/xml'}).window.document;
        const root = dom.children[0];
        
        expect(root, 'queried for', 'Description > Data', 'to have items satisfying',
          'to have attributes',
          {href: `shdr://${config.get('app:address')}:${config.get('app:machinePort')}`});
      });
    });
  });
  
  describe('SHDR Stream', () => {
    let listener;
    let reader;
    let socket;
    
    beforeEach('Start server', () => {
      listener = device('./test/support/mazak01.log')
        .listen(config.get('app:machinePort'), '127.0.0.1');
      socket = net.createConnection(config.get('app:machinePort'), '127.0.0.1');
      reader = rl.createInterface(socket);
    });
    
    afterEach('Stop server', () => {
      listener.close();
      reader.close();
      socket.destroy();
    });
    
    it('should stream data when opened', function* data() {
      this.timeout(4000);
      
      reader.pause();
      socket.setNoDelay(true);
      
      expect(yield getLine(reader), 'to contain', 'Tool_number|16');
      expect(yield getLine(reader), 'to contain', 'Tool_suffix|C');
      expect(yield getLine(reader), 'to contain', 'Bdeg|90');
    });
    
    it('should respond to a PING with a PONG', function* data() {
      // const socket = net.createConnection(config.get('app:machinePort'), '127.0.0.1');
      socket.setNoDelay(true);
      socket.write('* PING\n');
      
      const reader = rl.createInterface(socket);
      reader.pause();
      
      expect(yield getLine(reader), 'to equal', '* PONG 10000');
    });
  });
});
