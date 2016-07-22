/**
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

const fs = require('fs');
const net = require('net');
const http = require('http');

// Imports - Internal

const ip = require('ip');
const log = require('./config/logger');
const common = require('./common');

// Constants

const UUID = '000';
const nodeStatic = require('node-static');
const MACHINE_PORT = 7879;
const maxDelay = 3000;

// Instances

const machine = net.createServer();
const SSDP = require('node-ssdp').Server;
const file = new nodeStatic.Server('./public');
const adapter = new SSDP({ location: `${ip.address()}:${MACHINE_PORT}`,
                          udn: `${UUID}`, adInterval: 10000 });

// Functions

/**
  * machineDataGenerator() returns a generator that provides
  * simulation data from simple_scenario_1.txt.
  */
function* machineDataGenerator() {
  const inputFile = './public/sample_test.txt'; // chek_list for checking overflow
  const data = fs.readFileSync(inputFile).toString().split(/['\n','\r']+/);
  yield* data[Symbol.iterator]();
}

/**
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

/**
  * writeData() sends machine data to the Agent
  *
  * @param {Object} socket
  * @param {Object} machineData
  */
function writeData(socket, machineData, delay) {
  const data = dataExists(machineData);

  if (data) {
    setTimeout(() => {
      try {
        socket.write(data);
        writeData(socket, machineData, delay);
      } catch (e) {
        common.processError(`Error: ${e}`, false);
      }
    }, Math.floor(Math.random() * delay)); // Simulate delay
  } else {
    socket.destroy();
  }
}

/**
 * Simulator (adapter)
 */

machine.on('connection', (socket) => {
  const machineData = machineDataGenerator();

  writeData(socket, machineData, maxDelay);
});

machine.on('error', (err) => {
  common.processError(`${err}`, true);
});

function startSimulator(port, ipaddress) {
  machine.listen(port, ipaddress);

  log.info('Starting machine TCP server on port %d', port);
}

function stopSimulator() {
  machine.close();
}

/**
 *  HTTP serve Device definition file
 */

const fileServer = http.createServer((request, response) => {
  request.addListener('end', () => {
    /**
      *  Serve files!
      */
    file.serve(request, response);
  }).resume();
});

fileServer.on('error', (err) => {
  common.processError(`${err}`, true);
});

function startFileServer(port) {
  fileServer.listen(port);

  log.info('Starting HTTP web server on port %d', port);
}

function stopFileServer() {
  fileServer.close();
}

/**
 * SSDP
 */

adapter.addUSN('urn:schemas-mtconnect-org:service:VMC-3Axis:1');

adapter.on('advertise-alive', (headers) => {
  log.debug(headers);
});

adapter.on('advertise-bye', (headers) => {
  log.debug(headers);
});

adapter.on('error', (err) => {
  common.processError(`${err}`, true);
});

adapter.start();

/**
 * Exit
 */

process.on('exit', () => {
  machine.close();
  fileServer.close();
  adapter.stop();
});

process.on('uncaughtException', (err) => {
  log.error(err);
});

// Exports

module.exports = {
  machineDataGenerator,
  startFileServer,
  stopFileServer,
  startSimulator,
  stopSimulator,
  dataExists,
  writeData,
};
