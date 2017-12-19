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

const config = require('./config');
const log = config.logger;
const {Server} = require('node-ssdp');

let server;

function stop() {
  if (!server) return;
  server.stop();
  server = false;
}

// Start adapter
// @retrurns promise
function start() {
  const ssdpOptions = {
    location: `http://${config.get('app:address')}:${config.get('app:filePort')}/`,
    udn: `uuid:${config.get('app:uuid')}`,
    adInterval: 10000,
    allowWildcards: true,
  };
  
  // return immediately if server is running
  if (server) return new Promise((resolve, reject) => resolve());
  
  server = new Server(ssdpOptions);
  server.on('advertise-alive', log.debug.bind(log));
  server.on('advertise-bye', () => setImmediate(log.debug.bind(log)));
  server.on('error', log.error.bind(log));
  server.addUSN(`urn:schemas-mtconnect-org:service:${config.get('app:urn')}:1`);
  process.on('exit', server.stop.bind(server));
  server.start();
  
  return new Promise((resolve, reject) => {
    if (!server.sock) reject();
    server.sock.once('listening', resolve);
    server.sock.once('error', reject);
  });
}

module.exports = {start, stop};
