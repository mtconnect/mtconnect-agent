/*
 * Copyright 2016, System Insights, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// TODO: Use module import/export
// TODO: How to do atomic Process.exit(1)?

// Imports

const log = require('./config/logger');
const ip = require('ip');
const fs = require('fs');
const net = require('net');
const http = require('http');

// Constants

const MACHINE_PORT = 8081;
const SERVE_FILE_PORT = 8080;
const nodeStatic = require('node-static');

// Instances

const machine = net.createServer();
const SSDP = require('node-ssdp').Server;
const file = new nodeStatic.Server('./public');
const adapter = new SSDP({ location: `${ip.address()}:${MACHINE_PORT}` });

// Functions

/*
 * processErrorExit() logs an error message
 * and exits with status code 1.
 *
 * @param {String} message
 */
function processErrorExit(message) {
  log.error(`Error: ${message}`);

  process.exit(1);
}

// Simulator (adapter)

/*
 * machineDataGenerator() returns a generator that provides
 * simulation data from simple_scenario_1.txt.
 */
function* machineDataGenerator() {
  const inputFile = './public/simple_scenario_1.txt';
  const data = fs.readFileSync(inputFile).toString().split('\n');

  yield* data[Symbol.iterator]();
}

machine.on('connection', (socket) => {
  const machineData = machineDataGenerator();

  function writeData() { // Writes SHDR data to Agent
    let data = '';

    // If simple_scenario_1.txt exists?
    try {
      data = machineData.next().value;
    } catch (e) {
      if (e.code === 'ENOENT') {
        processErrorExit('Input file not found!');
      } else {
        processErrorExit(`${e}`);
      }
    }

    // If data exists?
    if (data) {
      setTimeout(() => {
        socket.write(data);
        writeData(socket);
      }, Math.floor(Math.random() * 3000)); // Simulate delay
    } else {
      socket.destroy();
    }
  }
  writeData(socket);
});

machine.on('error', (err) => {
  processErrorExit(`${err}`);
});

machine.listen(MACHINE_PORT, ip.address());

log.info('Starting machine TCP server on port %d', MACHINE_PORT);

// HTTP serve Device definition file

const fileServer = http.createServer((request, response) => {
  request.addListener('end', () => {
    /*
     *  Serve files!
     */
    file.serve(request, response);
  }).resume();
});

fileServer.on('error', (err) => {
  processErrorExit(`${err}`);
});

fileServer.listen(SERVE_FILE_PORT);

log.info('Starting HTTP web server on port %d', SERVE_FILE_PORT);

// SSDP

adapter.addUSN('urn:schemas-upnp-org:service:VMC-3Axis:1');

adapter.on('advertise-alive', (headers) => {
  console.log(headers);
});

adapter.on('advertise-bye', (headers) => {
  console.log(headers);
});

adapter.on('error', (err) => {
  processErrorExit(`${err}`);
});

adapter.start();

// Exit

process.on('exit', () => {
  machine.close();
  fileServer.close();
  adapter.stop();
});

// Exports

module.exports = {
  machineDataGenerator,
  fileServer,
};
