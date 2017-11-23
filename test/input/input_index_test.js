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


describe('input manager', () => {
  let inputManager;
  
  before(() => {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true,
    });
  
    const Manager = require('../../src/input');
    inputManager = new Manager({});
  });
  
  after(() => mockery.disable());
  
  beforeEach('create im', () => {
  
  });
  
  it('should have a shdr input adapter', () => {
    expect(inputManager.managers.shdr, 'not to be undefined');
  });
});