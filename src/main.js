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

// TODO Base filename should match the name of default export

// Imports - External

const Client = require('node-ssdp').Client; // Control Point
const Loki = require('lokijs');
const util = require('util');
const net = require('net');
const express = require('express');
const http = require('http');
const R = require('ramda');

// Imports - Internal

const lokijs = require('./lokijs');
const log = require('./config/logger');
const common = require('./common');
const dataStorage = require('./dataStorage');
const jsonToXML = require('./jsonToXML');
const config = require('./config/config');

// Instances

const agent = new Client();
const Db = new Loki('agent-loki.json');
const devices = Db.addCollection('devices');
const app = express();
const PING_INTERVAL = config.app.agent.pingInterval;
const DEVICE_SEARCH_INTERVAL = config.app.agent.deviceSearchInterval;
const AGENT_PORT = config.app.agent.agentPort;
const PATH_NAME = config.app.agent.path;

let insertedData;
let server;

/**
  * addDevice() finds the address, port and UUID
  *
  * @param {Object} headers
  *
  * return uuid
  *
  */
function addDevice(headers) {
  const headerData = JSON.stringify(headers, null, '  ');
  const data = JSON.parse(headerData);
  const location = data.LOCATION.split(':');
  const found = devices.find({ address: location[0], port: location[1] });
  const filePort = location[2];
  const uuidfound = data.USN.split(':');

  if (found.length < 1) {
    connectToDevice(location[0], location[1], uuidfound); // (address, port, uuid)
  }

  return { ip: location[0], port: filePort };
}

/**
  * connectToDevice() create socket connection to device
  *
  * @param {Object} address
  * @param {Object} port
  *
  * return uuid
  *
  */
function connectToDevice(address, port, uuid) {
  const c = new net.Socket();

  c.connect(port, address, () => {
    log.debug('Connected.');
  });

  c.on('data', (data) => {
    log.debug(`Received:  ${data}`);
    log.debug(data.toString());
    const dataString = String(data).split('\r'); // For Windows
    insertedData = R.pipe(common.inputParsing, lokijs.dataCollectionUpdate);
    insertedData(dataString[0]);
  });

  c.on('error', (err) => { // Remove device
    if (err.errno === 'ECONNREFUSED') {
      const found = devices.find({ address: err.address, port: err.port });

      if (found.length > 0) { devices.remove(found); }
    }
  });

  c.on('close', () => {
    const found = devices.find({ address: address, port: port });

    if (found.length > 0) { devices.remove(found); }
    log.debug('Connection closed');
  });

  devices.insert({ address: address, port: port , uuid: uuid});
}

/**
  * getDeviceXML() connect to <device-ip>:8080//sampledevice.xml and
  * get the deviceSchema in XML format.
  *
  * @param = null
  * returns null
  *
  */
function getDeviceXML(hostname, portNumber) {
  const options = {
    hostname: hostname,
    port: portNumber,
    path: PATH_NAME,
  };

  // GET ip:8080/VMC-3Axis.xml
  http.get(options, (res) => {
    log.debug(`Got response: ${res.statusCode}`);
    res.resume();
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      lokijs.updateSchemaCollection(chunk);
    });
  }).on('error', (e) => {
    log.error(`Got error: ${e.message}`);
  });
}


/* ****************************** Agent ****************************** */

// Search for interested devices
function searchDevices() {
  setInterval(() => {
    agent.search('urn:schemas-mtconnect-org:service:VMC-3Axis:1');
  }, DEVICE_SEARCH_INTERVAL);
}

function defineAgent() {
  agent.on('response', (headers) => {
    const result = addDevice(headers);
    const hostname = result['ip'];
    const portNumber = result['port'];

    getDeviceXML(hostname, portNumber);
  });

  agent.on('error', (err) => {
    common.processError(`${err}`, false);
  });

  searchDevices();
}

function currentImplementation(res, sequenceId) {
  const latestSchema = lokijs.searchDeviceSchema(uuid); // TODO: uuid cannot be global.
  const dataItemsArr = lokijs.getDataItem(uuid);

  if ((dataItemsArr === null) || (latestSchema === null)) {
    const errorData = jsonToXML.createErrorResponse('NO_DEVICE', uuid);
    jsonToXML.jsonToXML(JSON.stringify(errorData), res);
  } else {
    const dataItems = dataStorage.categoriseDataItem(latestSchema, dataItemsArr, sequenceId, uuid);
    if (dataItems === 'ERROR') {
      const errorData = jsonToXML.createErrorResponse('SEQUENCEID', sequenceId);
      jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    } else {
      const jsonData = jsonToXML.updateJSON(latestSchema, dataItems);
      jsonToXML.jsonToXML(JSON.stringify(jsonData), res);
    }
  }
  return;
}

function sampleImplementation(uuidVal, from, count, res, path) {
  const countVal = Number(count);
  const bufferSize = 1000; //dataStorage.bufferSize;

  // count error cases
  if ((countVal === 0) || (!Number.isInteger(countVal)) || (countVal < 0) || (countVal > bufferSize)) {
    const errorData = jsonToXML.createErrorResponse('COUNT', countVal);
    jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    return;
  }

  const latestSchema = lokijs.searchDeviceSchema(uuidVal);
  const dataItemsArr = lokijs.getDataItem(uuidVal);
  if ((dataItemsArr === null) || (latestSchema === null)) {
    const errorData = jsonToXML.createErrorResponse('NO_DEVICE', uuidVal);
    jsonToXML.jsonToXML(JSON.stringify(errorData), res);
  } else {
    const dataItems = dataStorage.categoriseDataItem(latestSchema, dataItemsArr,
                      from, uuidVal, count, path);

    if (dataItems === 'ERROR') {
      const errorData = jsonToXML.createErrorResponse('SEQUENCEID', from);
      jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    } else {
      const jsonData = jsonToXML.updateJSON(latestSchema, dataItems, 'SAMPLE');
      jsonToXML.jsonToXML(JSON.stringify(jsonData), res);
    }
  }
  return;
}

function defineAgentServer() {
  app.get('/current', (req, res) => {
    const reqPath = req._parsedUrl.path;
    const sequenceId = req._parsedUrl.path.split('at')[1];
    currentImplementation(res, sequenceId);
  });

  app.get('/probe', (req, res) => {
    const latestSchema = lokijs.searchDeviceSchema(uuid);
    const jsonSchema = lokijs.probeResponse(latestSchema);
    jsonToXML.jsonToXML(JSON.stringify(jsonSchema), res);
  });

  app.get('/sample', (req, res) => {
    const reqPath = req._parsedUrl.path;
    let from;
    let count = 100; // default TODO: config file
    let path;

    if (reqPath.includes('from=')) {
      const fromIndex = reqPath.search('from=');
      const countIndex = reqPath.search('&count=');
      from = reqPath.substring(fromIndex + 5, countIndex);
      count = reqPath.slice(countIndex + 7, reqPath.length);
    }
    if (reqPath.includes('path=')) {
      const pathStartIndex = reqPath.search('path=');
      const pathEndIndex = reqPath.search('&');
      if (pathEndIndex === -1) {
        path = reqPath.substring(pathStartIndex + 5, Infinity);
      } else {
        path = reqPath.substring(pathStartIndex + 5, pathEndIndex)
      }
      path = path.replace(/%22/g,'\"');
    }
    if (!(reqPath.includes('from='))) {
      const sequence = dataStorage.getSequence();
      from = sequence.firstSequence;
    }
    sampleImplementation(uuid, from, count, res, path);
  });
}

function startAgent() {
  defineAgent();
  defineAgentServer();
  startAgentServer();
}

function startAgentServer() {
  server = app.listen(AGENT_PORT, () => {
    log.debug('app listening on port %d', AGENT_PORT);
  });
}

function stopAgent() {
  server.close();
}

module.exports = {
  app,
  startAgent,
  stopAgent,
};
