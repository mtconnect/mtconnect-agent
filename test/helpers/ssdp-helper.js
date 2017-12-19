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

// Borrowed from node-ssdp
let sinon = require('sinon'),
  EE = require('events').EventEmitter,
  dgram = require('dgram');

function getFakeSocket() {
  const s = new EE();
  
  s.type = 'udp4';
  
  s.address = this.sinon.stub();
  s.address.returns({
    address: 1,
    port: 2,
  });
  
  s.addMembership = this.sinon.stub();
  s.setMulticastTTL = this.sinon.stub();
  s.setMulticastLoopback = this.sinon.stub();
  s.unref = this.sinon.stub();
  
  s.bind = function (/* port, addr, cb */) {
    const cb = [].slice.call(arguments).pop();
    
    if (typeof cb === 'function') cb();
  };
  
  this.sinon.spy(s, 'bind');
  
  s.send = this.sinon.stub();
  s.close = this.sinon.stub();
  
  return s;
}

beforeEach(function () {
  // ToDo: disable - don't think this is needed for upnp test. We want the real socket
//  this.sinon = sinon.sandbox.create();
//  this.sinon.stub(dgram, 'createSocket').callsFake(getFakeSocket.bind(this));
});

afterEach(function () {
  // ToDo: disable - don't think this is needed for upnp test. We want the real socket
//  this.sinon.restore();
});

