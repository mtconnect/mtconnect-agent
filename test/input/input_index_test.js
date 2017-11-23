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


describe('InputManager', () => {
  let inputManager;
  let fakeManager;
  
  before(() => {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true,
    });
    
    class FakeManager {
      constructor(manager) { this.manager = manager; }
      connectTo(uri, uuid) { }
      shutdown() { }
    };
    
    fakeManager = FakeManager;
    
    mockery.registerMock('./fake', FakeManager);
    
    const conf = require('../../src/configuration');
    conf.defaults({
      app: {
        input: {
          fake: { },
        },
      },
    });
    
    const Manager = require('../../src/input');
    inputManager = new Manager('DeviceManager');
  });
  
  after(() => mockery.disable());
  
  describe('with shdr', () => {
    it('should have a shdr input adapter', () => {
      expect(inputManager.managers.shdr, 'not to be undefined');
    });
  
    it('should have a shdr adapter that has a connectTo method', () => {
      expect(inputManager.managers.shdr.connectTo, 'not to be undefined');
      expect(inputManager.managers.shdr.connectTo, 'to have arity', 2);
    });
  
    it('should have a shdr adapter that has a shutdown method', () => {
      expect(inputManager.managers.shdr.shutdown, 'not to be undefined');
      expect(inputManager.managers.shdr.shutdown, 'to have arity', 0);
    });
  });
  
  describe('with fake', () => {
    let fakeConnectTo;
    let fakeShutdown;
    
    beforeEach('stub fake manager', () => {
      fakeConnectTo = sinon.spy(fakeManager.prototype, 'connectTo');
      fakeShutdown = sinon.spy(fakeManager.prototype, 'shutdown');
    });
    
    afterEach('restore', () => {
      fakeConnectTo.restore();
      fakeShutdown.restore();
    });
    
    it('should have a fake input adapter', () => {
      expect(inputManager.managers.fake, 'not to be undefined');
      expect(inputManager.managers.fake.manager, 'to equal', 'DeviceManager');
    });
  
    it('should have a fake adapter that has a connectTo method', () => {
      expect(inputManager.managers.fake.connectTo, 'not to be undefined');
      expect(inputManager.managers.fake.connectTo, 'to have arity', 2);
    });
  
    it('should have a fake adapter that has a shutdown method', () => {
      expect(inputManager.managers.fake.shutdown, 'not to be undefined');
      expect(inputManager.managers.fake.shutdown, 'to have arity', 0);
    });
    
    it('should call connectTo when connecting to fake://127.0.0.1:1234/ uuid: "1234"', () => {
      inputManager.connectTo('fake://127.0.0.1:1234/', '1234');
      expect(fakeConnectTo.args[0][0], 'to equal', 'fake://127.0.0.1:1234/');
      expect(fakeConnectTo.args[0][1], 'to equal', '1234');
    });
    
    it('should call adapter shutdown when the manager is shutdown', () => {
      inputManager.shutdown();
      expect(fakeShutdown.calledOnce, 'to be true');
    });
  });
});