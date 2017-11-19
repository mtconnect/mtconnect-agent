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

const config = require('../configuration');
const log = config.logger;
const EventEmitter = require('events');


class ShdrManager extends EventEmitter {
  constructor(manager) {
    super();
    this.running = false;
    this.connections = [];
    this.manager = manager;
  }
  
  connect({ ip, port, uuid }) {
    log.info(`Connecting to ${ip}:${port} for ${uuid}`);
    let heartbeatTimeout = null;
    
    const socket = net.createConnection(port, ip);
    socket.setNoDelay(true);
    
    const reader = rl.createInterface({ input: socket, output: socket });
    socket.write('* PING\n');
    
    this.connections.push(socket);
    
    reader.on('line', line => {
      log.info(`Recevied: ${line}`);
      
      const pong = line.match(/^\* PONG ([0-9]+)/);
      if (pong) {
        if (heartbeatTimeout) {
          clearTimeout(heartbeatTimeout);
          heartbeatTimeout = null;
        }
        
        // Process command
        const time = pong[1];
        heartbeatTimeout = setTimeout(() => {
          log.error(`Adapter unresponsive for more than ${time * 2}ms, closing`);
          reader.close();
          socket.end();
        }, time * 2);
        setTimeout(() => {
          if (!socket.destroyed) {
            try {
              socket.write('* PING\n');
            } catch (ex) {
              log.warn('Cannot write ping to socket');
            }
          }
        }, time);
      } else {
        common.parsing(String(line).trim(), uuid);
      }
    });
    
    reader.on('close', () => {
      if (heartbeatTimeout) {
        clearTimeout(heartbeatTimeout);
        heartbeatTimeout = null;
      }
      
      const found = devices.find({ $and: [{ address: ip }, { port }] });
      if (found.length > 0) {
        devices.remove(found);
      }
      log.debug('Connection closed');
    });
    
    devices.insert({ address: ip, port, uuid });
  }
  
  start() {
    this.running = true;
  }
  
  stop() {
    this.running = false;
    for (const con of this.connections) {
      con.end();
    }
  }
};

module.exports = ShdrManager;