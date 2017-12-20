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
const { EventEmitter } = require('events');

function createFakeSocket() {
  let s;
  if (!this.__proto__.socket) {
  
    s = new EventEmitter();
  
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
  
    s.bind = (...args) => {
      const cb = [].slice.call(args).pop();
    
      if (typeof cb === 'function') cb();
      s.emit('listening', null);
    };
  
    this.sinon.spy(s, 'bind');
  
    /* Loopback all messages to all listeners. */
    s.send = (msg, ...args) => {
      s.emit('message', msg, {
        address: '',
        family: 'IPv4',
        size: msg.length,
        port: 2 });
    }
    s.close = this.sinon.stub();
    
    this.__proto__.socket = s;
    
  } else {
    s = this.__proto__.socket;
  }
  
  
  return s;
}

module.exports = createFakeSocket;
