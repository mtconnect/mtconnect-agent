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
const net = require('net');
const express = require('express');
const http = require('http');
const R = require('ramda');
const es = require('event-stream');

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
// const PING_INTERVAL = config.app.agent.pingInterval;
const DEVICE_SEARCH_INTERVAL = config.app.agent.deviceSearchInterval;
const AGENT_PORT = config.app.agent.agentPort;
const PATH_NAME = config.app.agent.path;

// let insertedData;
let server;
let instanceId;

/**
  * processSHDR() process SHDR string
  *
  * @param {Object} data
  *
  * return uuid
  *
  */
function processSHDR(data, uuid) {
  log.debug(data.toString());
  const dataString = String(data).split('\r');
  const parsedInput = common.inputParsing(dataString[0]);
  lokijs.dataCollectionUpdate(parsedInput, uuid);
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

  c.on('data', () => {})
    .pipe(es.split())
    .pipe(es.map((data, cb) => {
      cb(null, processSHDR(data, uuid));
      return 0; // eslint
    }));

  c.on('error', (err) => { // Remove device
    if (err.errno === 'ECONNREFUSED') {
      const found = devices.find({ address: err.address, port: err.port });

      if (found.length > 0) { devices.remove(found); }
    }
  });

  c.on('close', () => {
    const found = devices.find({ address, port });

    if (found.length > 0) { devices.remove(found); }
    log.debug('Connection closed');
  });

  devices.insert({ address, port, uuid });
}

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
  const filePort = location[2];
  const uuidfound = data.USN.split(':');

  if (found.length < 1) {
    connectToDevice(location[0], location[1], uuidfound[0]); // (address, port, uuid)
  }

  return { ip: location[0], port: filePort };
}

/**
  * getDeviceXML() connect to <device-ip>:8080//sampledevice.xml and
  * get the deviceSchema in XML format.
  *
  * @param {String} hostname
  * @param {Number} portNumber - filePort
  * returns null
  *
  */
function getDeviceXML(hostname, portNumber) {
  const options = {
    hostname,
    port: portNumber,
    path: PATH_NAME,
  };

  let data = '';

  // GET ip:8080/VMC-3Axis.xml
  http.get(options, (res) => {
    log.debug(`Got response: ${res.statusCode}`);
    res.resume();
    res.setEncoding('utf8');

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (common.mtConnectValidate(data)) {
        lokijs.updateSchemaCollection(data);
      } else {
        log.error('Error: MTConnect validation failed');
      }
    });
  }).on('error', (e) => {
    log.error(`Got error: ${e.message}`);
  });
}



/* ****************************** Agent ****************************** */

// Search for interested devices
function searchDevices() {
  setInterval(() => {
    agent.search('urn:schemas-mtconnect-org:service:VMC-*');
  }, DEVICE_SEARCH_INTERVAL);
}


function defineAgent() {
  agent.on('response', (headers) => {
    const result = addDevice(headers);
    const hostname = result.ip;
    const portNumber = result.port;
    getDeviceXML(hostname, portNumber);
  });

  agent.on('error', (err) => {
    common.processError(`${err}`, false);
  });

  searchDevices();
}

function checkValidity(from, countVal, res) {
  // TODO change else if case, enable to handle multiple errors
  const count = Number(countVal);
  const fromVal = Number(from);
  const sequence = dataStorage.getSequence();
  const firstSequence = sequence.firstSequence;
  const lastSequence = sequence.lastSequence;
  const bufferSize = 1000; // TODO read from dataStorage.bufferSize;

  // from < 0 - INVALID request error
  if ((fromVal < 0) || (fromVal < firstSequence) || (fromVal > lastSequence)) {
    const errorData = jsonToXML.createErrorResponse(instanceId, 'FROM', fromVal);
    jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    return false;
  } else if ((count === 0) || (!Number.isInteger(count)) || (count < 0) || (count > bufferSize)) {
    const errorData = jsonToXML.createErrorResponse(instanceId, 'COUNT', count);
    jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    return false;
  }
  return true;
}

function currentImplementation(res, sequenceId, path, uuidCollection) {
  const jsonData = [];
  let uuid;
  let i = 0;
  R.map((k) => {
    uuid = k;
    const latestSchema = lokijs.searchDeviceSchema(uuid);
    const dataItemsArr = lokijs.getDataItem(uuid);
    if ((dataItemsArr === null) || (latestSchema === null)) {
      const errorData = jsonToXML.createErrorResponse(instanceId, 'NO_DEVICE', uuid);
      jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    } else {
      const dataItems = dataStorage.categoriseDataItem(latestSchema, dataItemsArr,
      sequenceId, uuid, path);
      if (dataItems === 'ERROR') {
        const errorData = jsonToXML.createErrorResponse(instanceId, 'SEQUENCEID', sequenceId);
        jsonToXML.jsonToXML(JSON.stringify(errorData), res);
      } else {
        jsonData[i++] = jsonToXML.updateJSON(latestSchema, dataItems, instanceId);
      }
    }
    return jsonData; // eslint
  }, uuidCollection);
  if (jsonData.length !== 0) {
    const completeJSON = jsonToXML.concatenateDeviceStreams(jsonData);
    jsonToXML.jsonToXML(JSON.stringify(completeJSON), res);
  }
}


function sampleImplementation(fromVal, count, res, path, uuidCollection) {
  let from;
  if (typeof(fromVal) !== Number) {
    from = Number(fromVal);
  } else {
    from = fromVal;
  }
  const jsonData = [];
  let uuidVal;
  let i = 0;
  R.map((k) => {
    uuidVal = k;
    const latestSchema = lokijs.searchDeviceSchema(uuidVal);
    const dataItemsArr = lokijs.getDataItem(uuidVal);
    if ((dataItemsArr === null) || (latestSchema === null)) {
      const errorData = jsonToXML.createErrorResponse(instanceId, 'NO_DEVICE', uuidVal);
      jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    } else {
      const dataItems = dataStorage.categoriseDataItem(latestSchema, dataItemsArr,
                        from, uuidVal, path, count);
      if (dataItems === 'ERROR') {
        const errorData = jsonToXML.createErrorResponse(instanceId, 'SEQUENCEID', from);
        jsonToXML.jsonToXML(JSON.stringify(errorData), res);
      } else {
        jsonData[i++] = jsonToXML.updateJSON(latestSchema, dataItems, instanceId, 'SAMPLE');
      }
    }
    return jsonData;
  }, uuidCollection);
  if (jsonData.length !== 0) {
    const completeJSON = jsonToXML.concatenateDeviceStreams(jsonData);
    jsonToXML.jsonToXML(JSON.stringify(completeJSON), res);
  }
  return;
}

function probeImplementation(res, uuidCollection) {
  const jsonSchema = [];
  let i = 0;
  let uuid;
  R.map((k) => {
    uuid = k;
    const latestSchema = lokijs.searchDeviceSchema(uuid);
    jsonSchema[i++] = lokijs.probeResponse(latestSchema);
    return jsonSchema;
  }, uuidCollection);
  if (jsonSchema.length !== 0) {
    const completeSchema = jsonToXML.concatenateDevices(jsonSchema);
    jsonToXML.jsonToXML(JSON.stringify(completeSchema), res);
  }
  return;
}

function handleCurrentReq(res, call, receivedPath, device, uuidCollection) {
  const reqPath = receivedPath;
  let sequenceId;
  // reqPath = /current?path=//Axes//Linear//DataItem[@subType="ACTUAL"]&at=50
  if (reqPath.includes('?at=')) { // /current?at=50
    sequenceId = receivedPath.split('?at=')[1]; // sequenceId = 50
  } else if (reqPath.includes('&at')) { // reqPath example
    sequenceId = receivedPath.split('&at=')[1]; // sequenceId = 50
  } else {
    sequenceId = undefined; // /current or /current?path=//Axes
  }

  let path;
  if (reqPath.includes('path=')) {
    const pathStartIndex = reqPath.search('path=');
    const pathEndIndex = reqPath.search('&');
    if (pathEndIndex === -1) { // /current?path=//Axes//Linear
      path = reqPath.substring(pathStartIndex + 5, Infinity); // //Axes//Linear
    } else { // reqPath case
      // path = //Axes//Linear//DataItem[@subType="ACTUAL"]
      path = reqPath.substring(pathStartIndex + 5, pathEndIndex);
      // path = path.replace(/%22/g, '"');
    }
    if (!common.pathValidation(path, uuidCollection)) {
      const errorData = jsonToXML.createErrorResponse(instanceId, 'INVALID_XPATH', path);
      jsonToXML.jsonToXML(JSON.stringify(errorData), res);
      return;
    }
     // TODo: check if needed
  }
  currentImplementation(res, sequenceId, path, uuidCollection);
}

function handleSampleReq(res, call, receivedPath, device, uuidCollection) {
  // eg: reqPath = /sample?path=//Device[@name="VMC-3Axis"]//Hydraulic&from=97&count=5
  const reqPath = receivedPath;
  let from;
  let count = 100; // default TODO: config file
  let path;

  if (reqPath.includes('from=')) {
    const fromIndex = reqPath.search('from=');
    const countIndex = reqPath.search('&count=');

    if (countIndex !== -1) { // if count specified in req eg: reqPath
      from = reqPath.substring(fromIndex + 5, countIndex); // 97
      count = reqPath.slice(countIndex + 7, reqPath.length); // 5
    } else { // /sample?from=97
      from = reqPath.substring(fromIndex + 5); // 97
    }
  }
  if (reqPath.includes('path=')) {
    const pathStartIndex = reqPath.search('path=');
    const pathEndIndex = reqPath.search('&'); // eg: reqPath
    if (pathEndIndex === -1) { // /sample?path=//Device[@name="VMC-3Axis"]
      path = reqPath.substring(pathStartIndex + 5, Infinity); // //Device[@name="VMC-3Axis"]
    } else { // reqPath
      // path = //Device[@name="VMC-3Axis"]//Hydraulic
      path = reqPath.substring(pathStartIndex + 5, pathEndIndex);
    }
    if (!common.pathValidation(path, uuidCollection)) {
      const errorData = jsonToXML.createErrorResponse(instanceId, 'INVALID_XPATH', path);
      jsonToXML.jsonToXML(JSON.stringify(errorData), res);
      return;
    }
    // path = path.replace(/%22/g, '"');
  }
  if (!(reqPath.includes('from='))) { // No from eg: /sample or /sample?path=//Axes
    const sequence = dataStorage.getSequence();
    from = sequence.firstSequence; // first sequenceId in CB
  }
  const valid = checkValidity(from, count, res);
  if (valid) {
    sampleImplementation(from, count, res, path, uuidCollection);
  }
}


function handleCall(res, call, receivedPath, device) {
  let uuidCollection;
  if (device === undefined) {
    uuidCollection = common.getAllDeviceUuids(devices);
  } else {
    uuidCollection = [common.getDeviceUuid(device)];
  }

  if (R.isEmpty(uuidCollection) || uuidCollection[0] === undefined) {
    const errorData = jsonToXML.createErrorResponse(instanceId, 'NO_DEVICE', device);
    jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    return;
  }
  if (call === 'current') {
    handleCurrentReq(res, call, receivedPath, device, uuidCollection);
    return;
  } else if (call === 'probe') {
    probeImplementation(res, uuidCollection);
    return;
  } else if (call === 'sample') {
    handleSampleReq(res, call, receivedPath, device, uuidCollection);
    return;
  }
  const errorData = jsonToXML.createErrorResponse(instanceId, 'UNSUPPORTED', receivedPath);
  jsonToXML.jsonToXML(JSON.stringify(errorData), res);
  return;
}


function defineAgentServer() {
  // handles all the incoming get request
  app.get('*', (req, res) => {
    // '/mill-1/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic'
    const receivedPath = req._parsedUrl.path;
    let device;
    let end = Infinity;
    let call;
    // 'mill-1/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic'
    let reqPath = receivedPath.slice(1, Infinity);
    const qm = reqPath.lastIndexOf('?'); // 13
    if (qm !== -1) { // if ? found
      reqPath = reqPath.substring(0, qm); // 'mill-1/sample'
    }
    const loc1 = reqPath.search('/');     // 6
    if (loc1 !== -1) {
      end = loc1;
    }
    const first = reqPath.substring(0, end); // 'mill-1'
    if (first === 'assets' || first === 'asset') {
      // TODO asset implementation
    } else {
       // If a '/' was found
      if (loc1 !== -1) {
        const loc2 = reqPath.includes('/', loc1 + 1); // check for another '/'
        if (loc2) {
          const errorData = jsonToXML.createErrorResponse(instanceId, 'UNSUPPORTED', receivedPath);
          jsonToXML.jsonToXML(JSON.stringify(errorData), res);
          return;
        }
        device = first;
        call = reqPath.substring(loc1 + 1, Infinity);
      } else {
        // if reqPath = '/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic'
        call = first; // 'sample'
      }
      handleCall(res, call, receivedPath, device);
    }
  });
}

function startAgentServer() {
  server = app.listen(AGENT_PORT, () => {
    instanceId = common.getCurrentTimeInSec();
    log.debug('app listening on port %d', AGENT_PORT);
  });
}

// function getInstanceId() {
//   return instanceId;
// }

function stopAgent() {
  server.close();
}

function startAgent() {
  defineAgent();
  defineAgentServer();
  startAgentServer();
}


module.exports = {
  app,
  startAgent,
  stopAgent,
};
