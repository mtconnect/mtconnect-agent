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
const sha1 = require('sha1');
const fs = require('fs');
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
const SERVE_FILE_PORT = config.app.agent.filePort;
const PATH_NAME = config.app.agent.path;

let insertedData;
let server;

/**
  * addDevice() finds the address, port and UUID
  *
  * @param {Object} headers
  *
  * return ip
  *
  */
function addDevice(headers) {
  const headerData = JSON.stringify(headers, null, '  ');
  const data = JSON.parse(headerData);
  const location = data.LOCATION.split(':');
  const found = devices.find({ address: location[0], port: location[1] });
  const uuidfound = data.USN.split(':');

  if (found.length < 1) {
    connectToDevice(location[0], location[1], uuidfound[0]); // (address, port, uuid)
  }
  return location[0];
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
    const dataString = String(data).split('\r'); // For Windows // TODO :pass(uuid to dataCollectionUpdate)
    const parsedInput = common.inputParsing(dataString[0]);
    lokijs.dataCollectionUpdate(parsedInput, uuid);
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
function getDeviceXML(ip) {
  const options = {
    hostname: ip,
    port: SERVE_FILE_PORT,
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
    const ip = addDevice(headers);
    getDeviceXML(ip);
  });

  agent.on('error', (err) => {
    common.processError(`${err}`, false);
  });

  searchDevices();
}


function checkValidity(uuidVal, from, count, path, res) {
    const countVal = Number(count);
    const fromVal = Number(from);
    const sequence = dataStorage.getSequence();
    const firstSequence = sequence.firstSequence;
    const lastSequence = sequence.lastSequence;
    const bufferSize = 1000; //dataStorage.bufferSize; // count error cases
    const arrOfDataItems = lokijs.getDataItem(uuidVal);
    let existingPathArr = [];

    //TODO check uuid in active device list
    // if absent send NO_DEVICE error
    if (arrOfDataItems === null) {
      const errorData = jsonToXML.createErrorResponse('NO_DEVICE', uuidVal);
      jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    } else if (path) {
      for (let i = 0; i < arrOfDataItems.length; i++) {
        existingPathArr[i] = arrOfDataItems[i].path;
      }
      var pathCheck = R.find((k) => {
                        return k.includes(path);
                      }, existingPathArr);
     if (pathCheck === undefined) {
       const errorData = jsonToXML.createErrorResponse('INVALIDPATH', path);
       jsonToXML.jsonToXML(JSON.stringify(errorData), res);
       return false;
     }
    }

  // from < 0 - INVALID request error
  if ((fromVal < 0) || (fromVal < firstSequence) || (fromVal > lastSequence)) {
    const errorData = jsonToXML.createErrorResponse('FROM', fromVal);
    jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    return false;
  }
  // count
  if ((countVal === 0) || (!Number.isInteger(countVal)) || (countVal < 0)
   || (countVal > bufferSize)) {
    const errorData = jsonToXML.createErrorResponse('COUNT', countVal);
    jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    return false;
  }

 //path - INVALID X_PATH
 //path - UNSUPPORTED
 return true;
}


function getAllDeviceUuids() {
  let setOfDevice = devices.data;
  let uuidSet = [];
  for (let i = 0; i < setOfDevice.length; i++)
  {
    uuidSet[i] = setOfDevice[i].uuid;
  }
  return uuidSet;
}


function currentImplementation(res, sequenceId, path) {
  console.log(sequenceId, path)
  // TODO 2: find all uuids from device collection, for each uuid do the following
  const uuidCollection = getAllDeviceUuids();
  const jsonData = [];
  let i = 0;
  R.map((k) => {
    let uuid = k;
    const latestSchema = lokijs.searchDeviceSchema(uuid); // TODO 2: uuid cannot be global.
    const dataItemsArr = lokijs.getDataItem(uuid);
    if ((dataItemsArr === null) || (latestSchema === null)) {
      const errorData = jsonToXML.createErrorResponse('NO_DEVICE', uuid);
      jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    } else {
      const dataItems = dataStorage.categoriseDataItem(latestSchema, dataItemsArr, sequenceId, uuid, path);
      if (dataItems === 'ERROR') {
        const errorData = jsonToXML.createErrorResponse('SEQUENCEID', sequenceId);
        jsonToXML.jsonToXML(JSON.stringify(errorData), res);
      } else {
        jsonData[i++] = jsonToXML.updateJSON(latestSchema, dataItems);
       //TODO: concatenate devices of both jsonData
      }
    }
  }, uuidCollection);
  const completeJSON = jsonToXML.concatenateDevices(jsonData);
  jsonToXML.jsonToXML(JSON.stringify(completeJSON), res);
  return;
}


function sampleImplementation(uuidVal, from, count, res, path) {
  const latestSchema = lokijs.searchDeviceSchema(uuidVal);
  const dataItemsArr = lokijs.getDataItem(uuidVal);
  if ((dataItemsArr === null) || (latestSchema === null)) {
    const errorData = jsonToXML.createErrorResponse('NO_DEVICE', uuidVal);
    jsonToXML.jsonToXML(JSON.stringify(errorData), res);
  } else {
    const dataItems = dataStorage.categoriseDataItem(latestSchema, dataItemsArr,
                      from, uuidVal, path, count);
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
    let sequenceId;
    if (reqPath.includes('?at')) {
      sequenceId = req._parsedUrl.path.split('?at')[1];
    } else if (reqPath.includes('&at')) {
      sequenceId = req._parsedUrl.path.split('&at')[1];
    } else {
      sequenceId = undefined;
    }
    let path;
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
    currentImplementation(res, sequenceId, path);
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
    const uuid = '000';
    if (reqPath.includes('from=')) {
      const fromIndex = reqPath.search('from=');
      const countIndex = reqPath.search('&count=');

      if (countIndex !== -1) {
        from = reqPath.substring(fromIndex + 5, countIndex);
        count = reqPath.slice(countIndex + 7, reqPath.length);
      } else {
        from = reqPath.substring(fromIndex + 5);
      }
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
    let valid = checkValidity(uuid, from, count, path, res);
    if (valid) {
        sampleImplementation(uuid, from, count, res, path);
    }
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
  getAllDeviceUuids,
};
