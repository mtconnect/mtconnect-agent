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

// TODO Base filename should match the name of default export

// Imports - External

const Client = require('node-ssdp').Client; // Control Point
const Loki = require('lokijs');
const util = require('util');
const net = require('net');

// Imports - Internal

const log = require('./config/logger');
const common = require('./common');

// Instances

const agent = new Client();
const db = new Loki('agent-loki.json');
const devices = db.addCollection('devices');

// TODO Global list of active sockets

// Agent

agent.on('response', (headers) => {
  // TODO Handle CACHE-CONTROL

  const headerData = JSON.stringify(headers, null, '  ');
  const data = JSON.parse(headerData);
  const location = data.LOCATION.split(':');

  const found = devices.find({ address: location[0], port: location[1] });

  // TODO Maybe remove old entries and insert the latest
  if (found.length < 1) {
    devices.insert({ address: location[0], port: location[1] });
  }
});

agent.on('error', (err) => {
  common.processErrorExit(`${err}`, false);
});

// Search for interested devices
setInterval(() => {
  agent.search('urn:schemas-upnp-org:service:VMC-3Axis:1');
}, 10000);

// TODO For each device in lokijs, create a socket and connect to it.
// Search for interested devices
setInterval(() => {
  const activeDevices = devices.find({});

  log.debug('activeDevices:');
  log.debug(util.inspect(activeDevices));

  activeDevices.forEach((d) => {
    const client = new net.Socket();

    client.connect(d.port, d.address, () => {
      console.log('Connected.');
    });

    client.on('data', (data) => {
      console.log(`Received: ${data}`);
    });

    client.on('close', () => {
      console.log('Connection closed');
    });

    client.on('error', () => {
      console.log('Connection error!');
    });
  });
}, 10000);
