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
// const bufferSize = config.app.agent.bufferSize;

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
  const parsedInput = common.inputParsing(dataString[0], uuid);
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

function getAdapterInfo(headers) {
  const headerData = JSON.stringify(headers, null, '  ');
  const data = JSON.parse(headerData);
  const location = data.LOCATION.split(':');

  const uuid = data.USN.split(':');

  return { ip: location[0], port: location[1], filePort: location[2], uuid: uuid[0] };
}

/**
  * addDevice()
  *
  * @param {String} hostname
  * @param {Number} portNumber
  * @param {String} uuid
  *
  * returns null
  */

function addDevice(hostname, portNumber, uuid) {
  const found = devices.find({ address: hostname, port: portNumber });
  const uuidFound = common.duplicateUuidCheck(uuid, devices);

  if ((found.length < 1) && (uuidFound.length < 1)) {
    connectToDevice(hostname, portNumber, uuid);
  }
}

/**
  * getDeviceXML() connect to <device-ip>:8080//VMC-3Axis.xml and
  * get the deviceSchema in XML format.
  *
  * @param {String} hostname
  * @param {Number} portNumber
  * @param {Number} filePort
  * @param {String} uuid
  *
  * returns null
  */
function getDeviceXML(hostname, portNumber, filePort, uuid) {
  const options = {
    hostname,
    port: filePort,
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
        addDevice(hostname, portNumber, uuid);
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
    const result = getAdapterInfo(headers);
    const hostname = result.ip;
    const portNumber = result.port;
    const filePort = result.filePort;
    const uuid = result.uuid;
    const obtainedXML = getDeviceXML(hostname, portNumber, filePort, uuid);
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
  if ((fromVal < 0) || (fromVal < firstSequence) || (fromVal > lastSequence) || isNaN(from)) {
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

function validateAssetList(arr) {
  const baseArr = lokijs.getAssetCollection();
  let valid;
  let obj;
  for (let i = 0; i < arr.length; i++) {
    valid = false;
    for (let j = 0; j < baseArr.length; j++) {
      if (arr[i] === baseArr[j]) {
        valid = true;
      }
    }
    if (!valid) {
      obj = { assetId: arr[i], status: false };
      return obj;
    }
  }
  obj = { assetId: 'all', status: true };
  return obj;
}

function assetImplementation(res, assetList, type, count, removed, target, archetypeId) {
  let assetCollection;
  const timeArr = [];
  let valid = {};
  const assetData = [];
  let reqType;
  let i = 0;
  if (assetList === undefined) {
    assetCollection = lokijs.getAssetCollection();
    valid.status = true;
    reqType = 'Assets';
  } else {
    assetCollection = assetList;
    valid = validateAssetList(assetCollection);
  }
  if (valid.status && !R.isEmpty(assetCollection)) {
    R.map((k) => {
      const assetItem = dataStorage.readAsset(k, type, count, removed, target, archetypeId);
      assetData[i++] = jsonToXML.createAssetResponse(instanceId, assetItem);
      const timestamp = assetItem.CuttingTool[0].$.timestamp;
      const index = i - 1;
      const obj = { timestamp, index };
      timeArr.push(obj);
      return k;
    }, assetCollection);
    const completeJSON = jsonToXML.concatenateAssets(assetData, timeArr, reqType);
    jsonToXML.jsonToXML(JSON.stringify(completeJSON), res);
    return;
  } else if (valid.status && R.isEmpty(assetCollection)) {
    assetData[i++] = jsonToXML.createAssetResponse(instanceId, { });
    const completeJSON = jsonToXML.concatenateAssets(assetData, timeArr);
    jsonToXML.jsonToXML(JSON.stringify(completeJSON), res);
    return;
  }
  const errorData = jsonToXML.createErrorResponse(instanceId, 'ASSET_NOT_FOUND', valid.assetId);
  jsonToXML.jsonToXML(JSON.stringify(errorData), res);
  return;
}


function handleProbeReq(res, uuidCollection) {
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
    sequenceId = Number(sequenceId);
  } else if (reqPath.includes('&at')) { // reqPath example
    sequenceId = receivedPath.split('&at=')[1]; // sequenceId = 50
    sequenceId = Number(sequenceId);
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
    }
    path = path.replace(/%22/g, '"');
    if (!common.pathValidation(path, uuidCollection)) {
      const errorData = jsonToXML.createErrorResponse(instanceId, 'INVALID_XPATH', path);
      jsonToXML.jsonToXML(JSON.stringify(errorData), res);
      return;
    }
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
      from = reqPath.substring(fromIndex + 5, countIndex); // in this eg: 97
      count = reqPath.slice(countIndex + 7, reqPath.length); // in this eg: 5
      count = Number(count);
    } else { // eg: /sample?from=97
      from = reqPath.substring(fromIndex + 5); // in this eg: 97
      from = Number(from);
    }
  }
  if (reqPath.includes('path=')) {
    const pathStartIndex = reqPath.search('path=');
    const pathEndIndex = reqPath.search('&'); // eg: reqPath
    if (pathEndIndex === -1) { // eg: /sample?path=//Device[@name="VMC-3Axis"]
      path = reqPath.substring(pathStartIndex + 5, Infinity); // eg //Device[@name="VMC-3Axis"]
    } else { // reqPath
      // eg: path = //Device[@name="VMC-3Axis"]//Hydraulic
      path = reqPath.substring(pathStartIndex + 5, pathEndIndex);
    }
    path = path.replace(/%22/g, '"');
    if (!common.pathValidation(path, uuidCollection)) {
      const errorData = jsonToXML.createErrorResponse(instanceId, 'INVALID_XPATH', path);
      jsonToXML.jsonToXML(JSON.stringify(errorData), res);
      return;
    }
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


function handleAssetReq(res, receivedPath) {
  let reqPath = receivedPath; // Eg:  /asset/assetId1;assetId2
  let assetList;
  let type;
  let count;
  let removed = false; // default value
  let target;
  let archetypeId;
  const firstIndex = reqPath.indexOf('/');
  reqPath = reqPath.slice(firstIndex + 1); // Eg: asset/assetId1;assetId2;


  if (reqPath.includes('/')) { // check for another '/'
    const index = reqPath.lastIndexOf('/') + 1;
    assetList = reqPath.slice(index, Infinity);
    if (assetList.includes(';')) {
      assetList = assetList.split(';'); // array of assetIds = [assetId1, assetId2]
    } else if (assetList.includes('?')) {
      const qm = assetList.indexOf('?'); // Eg: reqPath = /asset/assetId?type="CuttingTool"
      assetList = [assetList.slice(0, qm)]; // one id created to array, [assetId]
    } else {
      assetList = [assetList];
    }
  }

  if (reqPath.includes('type=')) {
    const typeStartIndex = reqPath.search('type=');
    const typeEndIndex = reqPath.search('&');
    if (typeEndIndex === -1) { // Eg: reqPath = /asset/assetId?type="CuttingTool"
      type = reqPath.substring(typeStartIndex + 5, Infinity); // "CuttingTool"
    } else {
      type = reqPath.substring(typeStartIndex + 5, typeEndIndex);
    }
  }

  if (reqPath.includes('count=')) {
    const countIndex = reqPath.search('count=');
    count = reqPath.slice(countIndex + 6, reqPath.length);
  }

  if (reqPath.includes('removed=')) {
    const removedIndex = reqPath.search('removed=');
    removed = reqPath.slice(removedIndex + 8, Infinity);
  }

  if (reqPath.includes('target=')) {
    const targetIndex = reqPath.search('target=');
    target = reqPath.slice(targetIndex + 7, Infinity);
  }

  if (reqPath.includes('archetypeId=')) {
    const archeTypeIndex = reqPath.search('archetypeId=');
    archetypeId = reqPath.slice(archeTypeIndex + 12, Infinity);
  }
  assetImplementation(res, assetList, type, count, removed, target, archetypeId);
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
    handleProbeReq(res, uuidCollection);
    return;
  } else if (call === 'sample') {
    handleSampleReq(res, call, receivedPath, device, uuidCollection);
    return;
  } // else if (call === 'asset' || call === 'assets') {
  //   handleAssetReq(res, receivedPath, device, uuidCollection);
  // }
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
    if (first === 'assets' || first === 'asset') { // Eg: http://localhost:5000/assets
      handleAssetReq(res, receivedPath);
      return;
    }
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
      // Eg: if reqPath = '/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic'
      call = first; // 'sample'
    }
    handleCall(res, call, receivedPath, device);
  });
}


function startAgentServer() {
  server = app.listen(AGENT_PORT, () => {
    instanceId = common.getCurrentTimeInSec();
    log.debug('app listening on port %d', AGENT_PORT);
  });
}


function stopAgent() {
  server.close();
}

function startAgent() {
  defineAgent();
  defineAgentServer();
  startAgentServer();
}


module.exports = {
  devices,
  app,
  startAgent,
  stopAgent,
  processSHDR,
  getAdapterInfo,
};
