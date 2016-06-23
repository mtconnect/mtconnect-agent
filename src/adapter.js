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

// Imports - External

const ip = require('ip');
const fs = require('fs');
const net = require('net');
const http = require('http');

// Imports - Internal

const log = require('./config/logger');
const common = require('./common');

// Constants

const MACHINE_PORT = 8081;
const SERVE_FILE_PORT = 8080;
const UUID = 'innovaluesthailand_CINCOMA26-1_b77e26';
const nodeStatic = require('node-static');

// Instances

const machine = net.createServer();
const SSDP = require('node-ssdp').Server;
const file = new nodeStatic.Server('./public');
const adapter = new SSDP({ location: `${ip.address()}:${MACHINE_PORT}`, udn: `${UUID}` });

// Functions

/*
 * machineDataGenerator() returns a generator that provides
 * simulation data from simple_scenario_1.txt.
 */
function* machineDataGenerator() {
  const inputFile = './public/sample_test.txt';
  const data = fs.readFileSync(inputFile).toString().split('\n');
  yield* data[Symbol.iterator]();
}

/*
 * dataExists() returns data from simple_scenario_1.txt.
 *
 * @param {Object} machineData
 * @return {String} data
 */
function dataExists(machineData) {
  let data = '';

  try {
    data = machineData.next().value;
    return data;
  } catch (e) {
    if (e.code === 'ENOENT') {
      common.processError('Input file not found!', true);
    } else {
      common.processError(`${e}`, true);
    }
  }
  return false; // Never gets called. To make eslint happy.
}

/*
 * writeData() sends machine data to the Agent
 *
 * @param {Object} socket
 * @param {Object} machineData
 */
function writeData(socket, machineData) {
  const data = dataExists(machineData);

  if (data) {
    setTimeout(() => {
      try {
        socket.write(data);
        writeData(socket, machineData);
      } catch (e) {
        common.processError(`Error: ${e}`, false);
      }
    }, Math.floor(Math.random() * 3000)); // Simulate delay
  } else {
    socket.destroy();
  }
}

/* ************************* Simulator (adapter) ************************* */

machine.on('connection', (socket) => {
  const machineData = machineDataGenerator();

  writeData(socket, machineData);
});

machine.on('error', (err) => {
  common.processError(`${err}`, true);
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
  common.processError(`${err}`, true);
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
  common.processError(`${err}`, true);
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
