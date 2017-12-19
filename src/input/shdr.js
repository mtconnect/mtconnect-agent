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
const url = require('url');

const log = config.logger;
const EventEmitter = require('events');

/**
 *
 */
class Shdr extends EventEmitter {
  constructor(address, port, uuid) {
    super();
    this.address = address;
    this.port = port;
    this.device = uuid;
  }
  
  connect() {
  }
  
  streamData() {
    log.info(`Connecting to ${ip}:${port} for ${uuid}`);
    let heartbeatTimeout = null;
    
    const socket = net.createConnection(port, ip);
    socket.setNoDelay(true);
    
    const reader = rl.createInterface({input: socket, output: socket});
    socket.write('* PING\n');
    
    this.connections.push(socket);
    
    reader.on('line', (line) => {
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
      
      const found = devices.find({$and: [{address: ip}, {port}]});
      if (found.length > 0) {
        devices.remove(found);
      }
      log.debug('Connection closed');
    });
    
    devices.insert({address: ip, port, uuid});
  }
  
  disconnected() {
  
  }
  
  /**
   * Close the connection and pass forward the event that this connection has been closed.
   */
  shutdown() {
    this.running = false;
    for (const con of this.connections) {
      con.end();
    }
    return this;
  }
}

/**
 * Creates a singleton manager for SHDR connections.
 */
class ShdrManager {
  /**
   * Initialized from configuration
   * @param manager
   */
  constructor(manager) {
    this.conf = config.get('app:input').shdr;
    this.running = false;
    this.manager = manager;
    this.connections = [];
  }
  
  /**
   * Connect to a URI in the form shdr://192.168.0.1:7878 where the host and port are 192.168.0.1 and port is
   * 7878.
   * @param uri
   * @param uuid
   */
  connectTo(uri, uuid) {
    const u = url.parse(uri);
    const {hostname, port} = u;
    const con = Shdr(hostname, port, uuid);
    con.connect()
      .then(this.connections.push)
      .catch(e => {
        log.error(e);
        throw e;
      });
    
    return con;
  }
  
  /**
   * Shutdown all the connections.
   */
  shutdown() {
    for (const c of this.connections) {
      c.shutdown();
    }
    return this;
  }
}

module.exports = ShdrManager;
