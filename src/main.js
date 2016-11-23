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

const Client = require('node-ssdp').Client; // Control Point
const Loki = require('lokijs');
const net = require('net');
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const R = require('ramda');
const es = require('event-stream');
const moment = require('moment');

// Imports - Internal

const config = require('./config/config');
const lokijs = require('./lokijs');
const log = require('./config/logger');
const common = require('./common');
const dataStorage = require('./dataStorage');
const jsonToXML = require('./jsonToXML');
const md5 = require('md5');

// Instances

const agent = new Client();
const Db = new Loki('agent-loki.json');
const devices = Db.addCollection('devices');
const app = express();
const DEVICE_SEARCH_INTERVAL = config.app.agent.deviceSearchInterval;
const URN_SEARCH = config.app.agent.urnSearch;
const AGENT_PORT = config.app.agent.agentPort;
const PATH_NAME = config.app.agent.path;
const PUT_ENABLED = config.app.agent.allowPut;

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

devices.on('delete', (obj) => {
  lokijs.updateBufferOnDisconnect(obj.uuid);
});

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
      const found = devices.find({ '$and': [{ address: err.address }, { port: err.port }] });

      if (found.length > 0) { devices.remove(found); }
    }
  });

  c.on('close', () => {
    const found = devices.find({ '$and': [{ address }, { port }] });
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
  const found = devices.find({ '$and': [{ hostname }, { port: portNumber }] });
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
    agent.search(`urn:schemas-mtconnect-org:service:${URN_SEARCH}`);
  }, DEVICE_SEARCH_INTERVAL);
}


function defineAgent() {
  agent.on('response', (headers) => {
    const result = getAdapterInfo(headers);
    const hostname = result.ip;
    const portNumber = result.port;
    const filePort = result.filePort;
    const uuid = result.uuid;
    getDeviceXML(hostname, portNumber, filePort, uuid);
  });

  agent.on('error', (err) => {
    common.processError(`${err}`, false);
  });

  searchDevices();
}


/**
  * validityCheck() checks for error conditions for current and sample requests
  * @param {String} call - current or sample
  * @param {Array} uuidCollection - collection of devices
  * @param {String} path - for eg: //Axes//Rotary
  * @param {Number} seqId - at = 1000 (current), from = 1000 (sample)
  * @param {Number} count - count = 10 (sample), undefined (current)
  * return {Object} obj  = { valid - true / false (error)
  *                         errorJSON - JSON object with all errors
  *                        }
  *
  */
function validityCheck(call, uuidCollection, path, seqId, count, freq) {
  const errorJSON = jsonToXML.createErrorResponse(instanceId);
  let errorObj = errorJSON.MTConnectError.Errors;
  const getSequence = dataStorage.getSequence();
  const firstSequence = getSequence.firstSequence;
  const lastSequence = getSequence.lastSequence;
  const bufferSize = dataStorage.getBufferSize();
  let valid = true;
  if (path) {
    if (!lokijs.pathValidation(path, uuidCollection)) {
      valid = false;
      errorObj = jsonToXML.categoriseError(errorObj, 'INVALID_XPATH', path);
    }
  }

  if (freq) {
    if ((freq < 0) || (!Number.isInteger(freq)) || (freq > 2147483646)) {
      valid = false;
      errorObj = jsonToXML.categoriseError(errorObj, 'INTERVAL', freq);
    }
  }
  if (call === 'current') {
    if (seqId || seqId === 0) { // seqId = 0, check whether it is in range
      if ((seqId < firstSequence) || (seqId > lastSequence)) {
        valid = false;
        errorObj = jsonToXML.categoriseError(errorObj, 'SEQUENCEID', seqId);
      }
    }
  } else {
    if ((seqId < 0) || (seqId < firstSequence) || (seqId > lastSequence) || isNaN(seqId)) {
      valid = false;
      errorObj = jsonToXML.categoriseError(errorObj, 'FROM', seqId);
    }
    if ((count === 0) || (!Number.isInteger(count)) || (count < 0) || (count > bufferSize)) {
      valid = false;
      errorObj = jsonToXML.categoriseError(errorObj, 'COUNT', count);
    }
  }
  const obj = {
    valid,
    errorJSON,
  };
  return obj;
}

/**
  * giveResponse() creates the json or xml response for sample and current when no error is present
  * @param {Object} jsonData - jsonObject with requested dataItems (MTConnectStream)
  * @param {String} acceptType - 'application/json' (JSON format) or undefined (xml format)
  * @param {Object} res - to give response to browser
  *
  */
function giveResponse(jsonData, acceptType, res) {
  if (jsonData.length !== 0) {
    const completeJSON = jsonToXML.concatenateDeviceStreams(jsonData);
    if (acceptType === 'application/json') {
      res.send(completeJSON);
      return;
    }
    jsonToXML.jsonToXML(JSON.stringify(completeJSON), res);
  }
}

function giveStreamResponse(jsonStream, boundary, res, acceptType) {
  if (acceptType === 'application/json') {
    const contentLength = jsonStream.length;
    res.write(`--${boundary}\r\n`);
    res.write(`Content-type: text/xml\r\n`);
    res.write(`Content-length:${contentLength}\r\n\r\n`);
    res.write(`${jsonStream}\r\n`);
  } else {
    jsonToXML.jsonToXMLStream(jsonStream, boundary, res);
  }
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
      const errorData = jsonToXML.createErrorResponse(instanceId, 'NO_DEVICE');
      jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    } else {
      const dataItems = dataStorage.categoriseDataItem(latestSchema, dataItemsArr,
      sequenceId, uuid, path);
      jsonData[i++] = jsonToXML.updateJSON(latestSchema, dataItems, instanceId);
    }
    return jsonData; // eslint
  }, uuidCollection);
  return jsonData;
}


function sampleImplementation(from, count, res, path, uuidCollection) {
  const jsonData = [];
  let uuidVal;
  let i = 0;
  R.map((k) => {
    uuidVal = k;
    const latestSchema = lokijs.searchDeviceSchema(uuidVal);
    const dataItemsArr = lokijs.getDataItem(uuidVal);
    if ((dataItemsArr === null) || (latestSchema === null)) {
      const errorData = jsonToXML.createErrorResponse(instanceId, 'NO_DEVICE');
      jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    } else {
      const dataItems = dataStorage.categoriseDataItem(latestSchema, dataItemsArr,
      from, uuidVal, path, count);
      jsonData[i++] = jsonToXML.updateJSON(latestSchema, dataItems, instanceId, 'SAMPLE');
    }
    return jsonData;
  }, uuidCollection);
  return jsonData;
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

// /assets  with type, count, removed, target, archetypeId etc
function assetImplementationForAssets(res, type, count, removed, target, archetypeId, acceptType) {
  const assetCollection = lokijs.getAssetCollection();
  let assetItem;
  const assetData = [];
  let i = 0;
  if (!R.isEmpty(assetCollection)) {
    assetItem = dataStorage.readAssets(assetCollection, type, count, removed, target, archetypeId);
    assetData[i++] = jsonToXML.createAssetResponse(instanceId, assetItem);
    const completeJSON = jsonToXML.concatenateAssetswithIds(assetData);
    if (acceptType === 'application/json') {
      res.send(completeJSON);
      return;
    }
    jsonToXML.jsonToXML(JSON.stringify(completeJSON), res);
    return;
  } // empty asset Collection
  assetData[i++] = jsonToXML.createAssetResponse(instanceId, { }); // empty asset response
  const completeJSON = jsonToXML.concatenateAssetswithIds(assetData);
  if (acceptType === 'application/json') {
    res.send(completeJSON);
    return;
  }
  jsonToXML.jsonToXML(JSON.stringify(completeJSON), res);
  return;
}

// max-len limit set to 150 in .eslintrc
function assetImplementation(res, assetList, type, count, removed, target, archetypeId, acceptType) {
  let valid = {};
  const assetData = [];
  let i = 0;
  if (assetList === undefined) {
    return assetImplementationForAssets(res, type, count, removed, target, archetypeId, acceptType);
  }
  const assetCollection = assetList;
  valid = validateAssetList(assetCollection);
  if (valid.status && !R.isEmpty(assetCollection)) {
    R.map((k) => {
      const assetItem = dataStorage.readAssetforId(k);
      assetData[i++] = jsonToXML.createAssetResponse(instanceId, assetItem);
      return k;
    }, assetCollection);
    const completeJSON = jsonToXML.concatenateAssetswithIds(assetData);
    if (acceptType === 'application/json') {
      return res.send(completeJSON);
    }
    return jsonToXML.jsonToXML(JSON.stringify(completeJSON), res);
  }
  const errorData = jsonToXML.createErrorResponse(instanceId, 'ASSET_NOT_FOUND', valid.assetId);
  return jsonToXML.jsonToXML(JSON.stringify(errorData), res);
}


function streamResponse(res, seqId, count, path, uuidCollection, boundary, acceptType, call) {
  let jsonData = '';
  if (call === 'current') {
    jsonData = currentImplementation(res, seqId, path, uuidCollection);
  } else {
    jsonData = sampleImplementation(seqId, count, res, path, uuidCollection);
  }

  if (jsonData.length !== 0) {
    const completeJSON = jsonToXML.concatenateDeviceStreams(jsonData);
    const jsonStream = JSON.stringify(completeJSON);
    giveStreamResponse(jsonStream, boundary, res, acceptType);
  }
}

// recursive function for current
function multiStreamCurrent(res, path, uuidCollection, freq, call, sequenceId, boundary, acceptType) {
  if (!res.req.client.destroyed) {
    setTimeout(() => {
      streamResponse(res, sequenceId, 0, path, uuidCollection, boundary, acceptType, call);
      return multiStreamCurrent(res, path, uuidCollection, freq, call, sequenceId, boundary, acceptType);
    }, freq);
  }
  return;
}


// recursive function for sample, from updated on each call
function multiStreamSample(res, path, uuidCollection, freq, call, from, boundary, count, acceptType) {
  if (!res.req.client.destroyed) {
    const timeOut = setTimeout(() => {
      if (from > dataStorage.getSequence().firstSequence) {
        streamResponse(res, from, count, path, uuidCollection, boundary, acceptType, call);
        const fromValue = dataStorage.getSequence().nextSequence;
        return multiStreamSample(res, path, uuidCollection, freq, call, fromValue, boundary, count, acceptType);
      }
      clearTimeout(timeOut);
      const errorData = jsonToXML.createErrorResponse(instanceId, 'MULTIPART_STREAM', from);
      return jsonToXML.jsonToXMLStream(JSON.stringify(errorData), boundary, res, 1);
    }, freq);
  }
  return;
}


function handleMultilineStream(res, path, uuidCollection, interval, call, sequenceId, count, acceptType) {
  // Header
  const boundary = md5(moment.utc().format());
  const time = new Date();
  const header1 = 'HTTP/1.1 200 OK\r\n' +
                  `Date: ${time.toUTCString()}\r\n` +
                  'Server: MTConnectAgent\r\n' +
                  'Expires: -1\r\n' +
                  'Connection: close\r\n' +
                  'Cache-Control: private, max-age=0\r\n' +
                  `Content-Type: multipart/x-mixed-replace;boundary=${boundary}` +
                  'Transfer-Encoding: chunked\r\n\r\n'; // comment this line to remove chunk size from appearing
  const freq = Number(interval);
  if (call === 'current') {
    const obj = validityCheck('current', uuidCollection, path, sequenceId, 0, freq);
    if (obj.valid) {
      res.setHeader('Connection', 'close'); // rewrite default value keep-alive
      res.writeHead(200, header1);
      streamResponse(res, sequenceId, 0, path, uuidCollection, boundary, acceptType, call);
      return multiStreamCurrent(res, path, uuidCollection, freq, call, sequenceId, boundary, acceptType);
    }
    return jsonToXML.jsonToXML(JSON.stringify(obj.errorJSON), res);
  } else if (call === 'sample') {
    const obj = validityCheck('sample', uuidCollection, path, sequenceId, count, freq);
    if (obj.valid) {
      res.setHeader('Connection', 'close'); // rewrite default value keep-alive
      res.writeHead(200, header1);
      streamResponse(res, sequenceId, count, path, uuidCollection, boundary, acceptType, call);
      const fromVal = dataStorage.getSequence().nextSequence;
      return multiStreamSample(res, path, uuidCollection, freq, call, fromVal, boundary, count, acceptType);
    }
    return jsonToXML.jsonToXML(JSON.stringify(obj.errorJSON), res);
  }
  return log.error('Request Error');
  // TODO: ERROR INVALID request
}

// TODO: add NO_DEVICE error.
function handleProbeReq(res, uuidCollection, acceptType) {
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
    if (acceptType === 'application/json') {
      res.send(completeSchema);
      return;
    }
    jsonToXML.jsonToXML(JSON.stringify(completeSchema), res);
  }
  return;
}


function handleCurrentReq(res, call, receivedPath, device, uuidCollection, acceptType) {
  const reqPath = receivedPath;
  let sequenceId;
  let freq;
  let atExist = false;
  // reqPath = /current?path=//Axes//Linear//DataItem[@subType="ACTUAL"]&at=50

  // at
  if (reqPath.includes('?at=')) { // /current?at=50
    sequenceId = receivedPath.split('?at=')[1]; // sequenceId = 50
    sequenceId = Number(sequenceId);
    atExist = true;
  } else if (reqPath.includes('&at')) { // reqPath example
    sequenceId = receivedPath.split('&at=')[1]; // sequenceId = 50
    sequenceId = Number(sequenceId);
    atExist = true;
  } else {
    sequenceId = undefined; // /current or /current?path=//Axes
    atExist = false;
  }

  let path;
  if (reqPath.includes('path=')) {
    const pathStartIndex = reqPath.search('path=');
    const editedPath = reqPath.substring(pathStartIndex + 5, Infinity);
    let pathEndIndex = editedPath.search('&');
    if (pathEndIndex === -1) { // /current?path=//Axes//Linear
      pathEndIndex = Infinity; // //Axes//Linear
    }
    path = editedPath.substring(0, pathEndIndex);
    // for reqPath path = //Axes//Linear//DataItem[@subType="ACTUAL"]
    path = path.replace(/%22/g, '"'); // "device_name", "type", "subType"
  }

  if (reqPath.includes('frequency=')) {
    if (atExist) {
      const errorData = jsonToXML.createErrorResponse(instanceId, 'INVALID_REQUEST');
      return jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    }
    const freqStart = reqPath.search('frequency=');
    let freqEnd = reqPath.search('&');
    if (freqEnd === -1) {
      freqEnd = Infinity;
    }
    freq = reqPath.substring(freqStart + 10, freqEnd);
    return handleMultilineStream(res, path, uuidCollection, freq, 'current', sequenceId, undefined, acceptType);
  }

  if (reqPath.includes('interval=')) {
    if (atExist) {
      const errorData = jsonToXML.createErrorResponse(instanceId, 'INVALID_REQUEST');
      return jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    }
    const intervalStart = reqPath.search('interval=');
    let intervalEnd = reqPath.search('&');
    if (intervalEnd === -1) {
      intervalEnd = Infinity;
    }
    freq = reqPath.substring(intervalStart + 9, intervalEnd);
    return handleMultilineStream(res, path, uuidCollection, freq, 'current', sequenceId, undefined, acceptType);
  }
  const obj = validityCheck('current', uuidCollection, path, sequenceId);
  if (obj.valid) {
    const jsonData = currentImplementation(res, sequenceId, path, uuidCollection);
    return giveResponse(jsonData, acceptType, res);
  }
  // if obj.valid = false ERROR
  return jsonToXML.jsonToXML(JSON.stringify(obj.errorJSON), res);
}

function handleSampleReq(res, call, receivedPath, device, uuidCollection, acceptType) {
  // eg: reqPath = /sample?path=//Device[@name="VMC-3Axis"]//Hydraulic&from=97&count=5
  const reqPath = receivedPath;
  let from;
  let count = 100; // default TODO: config file
  let path;
  let freq;

  if (reqPath.includes('from=')) {
    const fromIndex = reqPath.search('from=');
    const countIndex = reqPath.search('&count=');

    if (countIndex !== -1) { // if count specified in req eg: reqPath
      from = Number(reqPath.substring(fromIndex + 5, countIndex)); // in this eg: 97
      count = reqPath.slice(countIndex + 7, reqPath.length); // in this eg: 5
      count = Number(count);
    } else { // eg: /sample?from=97
      from = reqPath.substring(fromIndex + 5); // in this eg: 97
      from = Number(from);
    }
  }

  if (reqPath.includes('path=')) {
    const pathStartIndex = reqPath.search('path=');
    const editedPath = reqPath.substring(pathStartIndex + 5, Infinity);
    let pathEndIndex = editedPath.search('&'); // eg: reqPath
    if (pathEndIndex === -1) { // eg: /sample?path=//Device[@name="VMC-3Axis"]
      pathEndIndex = Infinity; // eg //Device[@name="VMC-3Axis"]
    }
    path = editedPath.substring(0, pathEndIndex);
    // eg: path = //Device[@name="VMC-3Axis"]//Hydraulic
    path = path.replace(/%22/g, '"');
  }

  if (!(reqPath.includes('from='))) { // No from eg: /sample or /sample?path=//Axes
    const sequence = dataStorage.getSequence();
    from = sequence.firstSequence; // first sequenceId in CB
  }

  if (reqPath.includes('frequency=')) {
    const freqStart = reqPath.search('frequency=');
    let freqEnd = reqPath.search('&');
    if (freqEnd === -1) {
      freqEnd = Infinity;
    }
    freq = reqPath.substring(freqStart + 10, freqEnd);
    return handleMultilineStream(res, path, uuidCollection, freq, 'sample', from, count, acceptType);
  }

  if (reqPath.includes('interval=')) {
    const intervalStart = reqPath.search('interval=');
    let intervalEnd = reqPath.search('&');
    if (intervalEnd === -1) {
      intervalEnd = Infinity;
    }
    freq = reqPath.substring(intervalStart + 9, intervalEnd);
    return handleMultilineStream(res, path, uuidCollection, freq, 'sample', from, count, acceptType);
  }

  const obj = validityCheck('sample', uuidCollection, path, from, count);

  if (obj.valid) {
    const jsonData = sampleImplementation(from, count, res, path, uuidCollection);
    return giveResponse(jsonData, acceptType, res);
  }
  // if obj.valid = false ERROR
  return jsonToXML.jsonToXML(JSON.stringify(obj.errorJSON), res);
}

/**
  * handleAssetReq() handle all asset request and calls assetImplementation if the request is valid
  * @param {Object} res
  * @param {String} receivedPath - /asset/assetId1;assetId2
  * @param {String} acceptType - specifies xml or json format for response
  * @param {String} acceptType - undefined or  Eg: 'VMC-3Axis'
  */

// Asset call - localhost:7000/VMC-3Axis/assets
// receivedPath /VMC-3Axis/assets deviceName VMC-3Axis
// reqPath VMC-3Axis/assets
// firstEntry VMC-3Axis
// assetList assets
function handleAssetReq(res, receivedPath, acceptType, deviceName) {
  let reqPath = receivedPath; // Eg1:  /asset/assetId1;assetId2
                              // Eg2:  /assets
  let assetList;
  let type;
  let count;
  let removed = false; // default value
  let target = deviceName;
  let archetypeId;
  const firstIndex = reqPath.indexOf('/');
  reqPath = reqPath.slice(firstIndex + 1); // Eg1: asset/assetId1;assetId2;
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
    let typeEndIndex = reqPath.search('&');
    if (typeEndIndex === -1) { // Eg: reqPath = /asset/assetId?type="CuttingTool"
      typeEndIndex = Infinity; // "CuttingTool"
    }
    type = reqPath.substring(typeStartIndex + 5, typeEndIndex);
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
  assetImplementation(res, assetList, type, count, removed, target, archetypeId, acceptType);
}


/**
  * handleGet() handles http 'GET' request and calls function depending on the value of call
  * @param {Object} res
  * @param {String} call -
  * @param
  * @param
  */
function handleCall(res, call, receivedPath, device, acceptType) {
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
    handleCurrentReq(res, call, receivedPath, device, uuidCollection, acceptType);
    return;
  } else if (call === 'probe') {
    handleProbeReq(res, uuidCollection, acceptType);
    return;
  } else if (call === 'sample') {
    handleSampleReq(res, call, receivedPath, device, uuidCollection, acceptType);
    return;
  } else if (call === 'asset' || call === 'assets') {
    const index = receivedPath.search(device); // receivedPath: /VMC-3Axis/asset
    const editReceivedPath = receivedPath.slice(device.length + 1); // /asset
    handleAssetReq(res, editReceivedPath, acceptType, device);
    return;
  }
  const errorData = jsonToXML.createErrorResponse(instanceId, 'UNSUPPORTED', receivedPath);
  jsonToXML.jsonToXML(JSON.stringify(errorData), res);
  return;
}


/**
  * handlePut() handles PUT and POST request from putEnabled devices.
  * @param {Object} res
  * @param {String} adapter - Eg: VMC-3Axis or undefined
  * @param {String} receivedPath - Eg: /VMC-3Axis
  * @param {String} deviceName - Eg: undefined or VMC-3Axis
  */
// Req = curl -X PUT -d avail=FOOBAR localhost:7000/VMC-3Axis
// adapter = VMC-3Axis, receivedPath = /VMC-3Axis, deviceName = undefined
function handlePut(res, adapter, receivedPath, deviceName) {
  let device = deviceName;
  const errCategory = 'UNSUPPORTED_PUT';
  let cdata = '';
  if (device === undefined && adapter === undefined) {
    cdata = 'Device must be specified for PUT';
    const errorData = jsonToXML.createErrorResponse(instanceId, errCategory, cdata);
    return jsonToXML.jsonToXML(JSON.stringify(errorData), res);
  } else if (device === undefined) {
    device = adapter;
  }

  const uuidVal = common.getDeviceUuid(device);
  if (uuidVal === undefined) {
    cdata = `Cannot find device:${device}`;
    const errorData = jsonToXML.createErrorResponse(instanceId, errCategory, cdata);
    return jsonToXML.jsonToXML(JSON.stringify(errorData), res);
  }
  const body = res.req.body;
  if (R.hasIn('_type', body) && (R.pluck('_type', [body])[0] === 'command')) {
    console.log('command');
    // TODO: add code for command
  } else {
    const keys = R.keys(body);
    const jsonData = {
      time: '',
      dataitem: [],
    };
    jsonData.time = moment.utc().format();

    R.map((k) => {
      const data = R.pluck(k, [body]);
      if (k === 'time') {
        jsonData.time = data;
      } else {
        jsonData.dataitem.push({ name: k, value: data[0] });
      }
      return jsonData;
    }, keys);

    lokijs.dataCollectionUpdate(jsonData, uuidVal);
  }
  return res.send('<success/>\r\n');
}


/**
  * handleRequest() classifies depending on the request method or assets
  * and call handleGet(), handlePut or handleAssetReq
  * @param {Object} req
  * @param {Object} res
  * returns null
  */
function handleRequest(req, res) {
  let acceptType;
  if (req.headers.accept) {
    acceptType = req.headers.accept;
  }
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
  if (first === 'assets' || first === 'asset') { // Eg: http://localhost:7000/assets
    handleAssetReq(res, receivedPath, acceptType);
    return;
  }
   // If a '/' was found
  if (loc1 !== -1) {
    const loc2 = reqPath.includes('/', loc1 + 1); // check for another '/'
    if (loc2) {
      let nextString = reqPath.slice(loc1 + 1, Infinity);
      const nextSlash = nextString.search('/');
      nextString = nextString.slice(0, nextSlash);
      if (nextString === 'asset' || nextString === 'assets') {
        device = first;
        const editReceivedPath = receivedPath.slice(device.length + 1);
        handleAssetReq(res, editReceivedPath, acceptType, device);
        return;
      }
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
  if (req.method === 'GET') {
    handleCall(res, call, receivedPath, device, acceptType);
  } else { // PUT or POST
    handlePut(res, call, receivedPath, device, acceptType);
  }
}

/**
  * requestErrorCheck() checks the validity of the request method
  * @param {Object} res
  * @param {String} method - 'GET', 'PUT, POST' etc
  * returns {Boolean} validity - true, false
  */
function requestErrorCheck(res, method) {
  let validity;
  const errCategory = 'UNSUPPORTED_PUT';
  let cdata = '';
  if (PUT_ENABLED) {
    // if ((method === 'PUT') || (method === 'POST')) { //Add hostCollectionCheck (putAllowedHost  = nonempty, and ip not present)
    //   validity = false;
    //   cdata = `HTTP PUT is not allowed from ip_address`;
    //   const errorData = jsonToXML.createErrorResponse(instanceId, errCategory, uuid, cdata);
    //   jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    // }
    if (method !== 'GET' && method !== 'PUT' && method !== 'POST') {
      validity = false;
      cdata = 'Only the HTTP GET and PUT requests are supported';
      const errorData = jsonToXML.createErrorResponse(instanceId, errCategory, cdata);
      return jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    }
  } else {
    if (method !== 'GET') {
      validity = false;
      cdata = 'Only the HTTP GET request is supported';
      const errorData = jsonToXML.createErrorResponse(instanceId, errCategory, cdata);
      return jsonToXML.jsonToXML(JSON.stringify(errorData), res);
    }
  }
  validity = true;
  return validity;
}

/**
  * defineAgentServer() handles all the html request to server
  *
  */
function defineAgentServer() { // TODO check for requestType 'get' and 'put'
  // handles all the incoming request
  app.use(bodyParser.urlencoded({ extended: true, limit: 10000 }));
  app.use(bodyParser.json());
  app.all('*', (req, res) => {
    const validRequest = requestErrorCheck(res, req.method);
    if (validRequest) {
      return handleRequest(req, res);
    }
    return console.log('error');
  });
}

/**
  * startAgentServer() starts the server listen in AGENT_PORT
  * instanceId is unique for any instance of agent.
  *
  */
function startAgentServer() {
  server = app.listen(AGENT_PORT, () => {
    instanceId = common.getCurrentTimeInSec();
    log.debug('app listening on port %d', AGENT_PORT);
  });
}

/**
  * stopAgent() close the server
  */
function stopAgent() {
  server.close();
}


/**
  * startAgent() starts the agent
  */
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
  searchDevices,
  getDeviceXML,
};
