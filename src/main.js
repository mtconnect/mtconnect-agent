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
const PUT_ENABLED = config.app.agent.allowPut; // Allow HTTP PUT or POST of data item values or assets.
const putAllowedHosts = config.app.agent.AllowPutFrom; // specific host or list of hosts (hostnames)


// IgnoreTimestamps  - Ignores timeStamp with agent time.

let server;
let instanceId;
let queryError = false;


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


/**/
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
  let dupCheck = 0;

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
        dupCheck = lokijs.updateSchemaCollection(data);
        // if a duplicateId exist, exit process.
        if (dupCheck) {
          stopAgent();
          process.exit();
        }
      } else {
        log.error('Error: MTConnect validation failed');
      }
    });
  }).on('error', (e) => {
    log.error(`Got error: ${e.message}`);
  });
}


/* ****************************** Agent ****************************** */

/* *** Error Handling *** */
function errResponse(res, acceptType, errCode, value) {
  let errorData;
  if (errCode === 'validityCheck') {
    errorData = value
  } else {
    errorData = jsonToXML.createErrorResponse(instanceId, errCode, value);
  }
  if (acceptType === 'application/json') {
    res.send(errorData);
    return;
  }
  return jsonToXML.jsonToXML(JSON.stringify(errorData), res);
}




/**
  * searchDevices search for interested devices periodically
  * @param null
  * returns null
  */
function searchDevices() {
  setInterval(() => {
    agent.search(`urn:schemas-mtconnect-org:service:${URN_SEARCH}`);
  }, DEVICE_SEARCH_INTERVAL);
}

/**
  * stopAgent() close the server
  */
function stopAgent() {
  return server.close();
}

/**
  * defineAgent() defines the functionalities of agent
  * On response it gets the adapter info and det the device.xml
  * On error - it sends error msg
  * serach for devices periodically
  */
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
  const maxFreq = 2147483646;
  let valid = true;
  if (path) {
    if (!lokijs.pathValidation(path, uuidCollection)) {
      valid = false;
      errorObj = jsonToXML.categoriseError(errorObj, 'INVALID_XPATH', path);
    }
  }
  if (freq) {
    if ((freq < 0) || (!Number.isInteger(freq)) || (freq > maxFreq)) {
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
  * checkAndGetParam() checks whether the parameter is empty and get the value of the parameter if not empty
  * if empty it will give query error response
  *
  *
  */
function checkAndGetParam(res, acceptType, req, param, defaultVal, number) {
  const param1 = `${param}=`;
  let rest;
  let paramEnd;
  if (req.includes(param1)) {
    const paramStart = req.search(param1);
    const length = param1.length;
    const start = paramStart + length;
    rest = req.slice(start);
  } else {
    return defaultVal;
  }

  if (rest.includes('?') || rest.includes('&')) {
    paramEnd = rest.search(/(\?|&)/);
  } else {
    paramEnd = Infinity;
  }
  let paramVal = rest.slice(0, paramEnd);
  if (paramVal === '') {
    queryError = true;
    return errResponse(res, acceptType, 'QUERY_ERROR', param);
  }
  if (number) {
    paramVal = Number(paramVal);
  }
  return paramVal;
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

/**
  * giveStreamResponse() gives the stream response in JSON or xml format
  * @param {Object} jsonStream - multipart stream data
  * @param {String} boundary - 32 bit tagline
  * @param {Object} res - http response object
  * @param {String} acceptType - specifies required format for response
  */
function giveStreamResponse(jsonStream, boundary, res, acceptType, isError) {
  if (acceptType === 'application/json') {
    const contentLength = jsonStream.length;
    res.write(`--${boundary}\r\n`);
    res.write(`Content-type: text/xml\r\n`);
    res.write(`Content-length:${contentLength}\r\n\r\n`);
    res.write(`${jsonStream}\r\n`);
    if (isError) {
      res.write(`\r\n--${boundary}--\r\n`);
      res.end(); // ends the connection
    }
  } else {
    jsonToXML.jsonToXMLStream(jsonStream, boundary, res, isError);
  }
}

/**
  * currentImplementation() creates the response for /current request
  * @param {Object} res - http response object
  * @param {Number} sequenceId - at value if specified in request/ undefined
  * @param {String} path - path specified in req Eg: path=//Axes//Rotary
  * @param {Array} uuidCollection - list of all the connected devices' uuid.
  */
function currentImplementation(res, acceptType, sequenceId, path, uuidCollection) {
  const jsonData = [];
  let uuid;
  let i = 0;
  R.map((k) => {
    uuid = k;
    const latestSchema = lokijs.searchDeviceSchema(uuid);
    const dataItemsArr = lokijs.getDataItem(uuid);
    const deviceName = lokijs.getDeviceName(uuid);
    if ((dataItemsArr === null) || (latestSchema === null)) {
      return errResponse(res, acceptType, 'NO_DEVICE', deviceName);
    } else {
      const dataItems = dataStorage.categoriseDataItem(latestSchema, dataItemsArr,
      sequenceId, uuid, path);
      jsonData[i++] = jsonToXML.updateJSON(latestSchema, dataItems, instanceId);
    }
    return jsonData; // eslint
  }, uuidCollection);
  return jsonData;
}

/**
  * sampleImplementation() creates the response for /current request
  * @param {Object} res - http response object
  * @param {Number} from - from value if specified in request/ firstSequence
  * @param {String} path - path specified in req Eg: path=//Axes//Rotary
  * @param {Number} count - number of dataItems should be shown maximum.
  * @param {Array} uuidCollection - list of all the connected devices' uuid.
  */
function sampleImplementation(res, acceptType, from, count, path, uuidCollection) {
  const jsonData = [];
  let uuidVal;
  let i = 0;
  R.map((k) => {
    uuid = k;
    const latestSchema = lokijs.searchDeviceSchema(uuid);
    const dataItemsArr = lokijs.getDataItem(uuid);
    const deviceName = lokijs.getDeviceName(uuid);
    if ((dataItemsArr === null) || (latestSchema === null)) {
      return errResponse(res, acceptType, 'NO_DEVICE', deviceName);
    } else {
      const dataItems = dataStorage.categoriseDataItem(latestSchema, dataItemsArr,
      from, uuid, path, count);
      jsonData[i++] = jsonToXML.updateJSON(latestSchema, dataItems, instanceId, 'SAMPLE');
    }
    return jsonData;
  }, uuidCollection);
  return jsonData;
}

/**
  * validateAssetList() - checks whether the specified assetids in request are valid
  * @param {Array} arr - array of assetIds
  * return {object} obj - { assetId, status }
  *
  */
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

/**
  * assetImplementationForAssets() handles request without assetIds specified
  * @param {Object} res
  * @param {String} type - eg. CuttingTool
  * @param {Number} count - no. of assets to be shown
  * @param {String} removed - mentioned tru when removed Assets need to be given in response.
  * @param {String} target - the device of interest (assets connected to this device will only be included in response)
  * @param {String} archetypeId
  * @param {String} acceptType - required output format - xml/json
  */
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
/**
  * assetImplementation() handles request with assetIds specified
  * @param {Object} res
  * @param {Array}  assetList - array of assetIds specified in request/ undefined if not specified
  * @param {String} type - eg. CuttingTool
  * @param {Number} count - no. of assets to be shown
  * @param {String} removed - mentioned true when removed Assets need to be given in response.
  * @param {String} target - the device of interest (assets connected to this device will only be included in response)
  * @param {String} archetypeId
  * @param {String} acceptType - required output format - xml/json
  */
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
  return errResponse(res, acceptType, 'ASSET_NOT_FOUND', valid.assetId);
}

/* *********************************** Multipart Stream Supporting Functions **************************** */
/**
  * streamResponse() gives the multipart strem for current and sample
  * @param {Object} res
  * @param {Number} seqId - at for current/ from for sample
  * @param {Number} count - no. of dataItems to be shown in response
  * @param {String} path - xpath eg: //Axes//Rotary
  * @param {Array} uuidCollection - list of uuids of all active device.
  * @param {String} boundary - tag for multipart stream
  * @param {String} acceptType - required output format - xml/json
  * @param {String} call - current / sample
  */
function streamResponse(res, seqId, count, path, uuidCollection, boundary, acceptType, call) {
  let jsonData = '';
  if (call === 'current') {
    jsonData = currentImplementation(res, acceptType, seqId, path, uuidCollection);
  } else {
    jsonData = sampleImplementation( res, acceptType, seqId, count, path, uuidCollection);
  }

  if (jsonData.length !== 0) {
    const completeJSON = jsonToXML.concatenateDeviceStreams(jsonData);
    const jsonStream = JSON.stringify(completeJSON);
    giveStreamResponse(jsonStream, boundary, res, acceptType, 0);
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


// recursive function for sample, from updated on each call with nextSequence
function multiStreamSample(res, path, uuidCollection, freq, call, from, boundary, count, acceptType) {
  if (!res.req.client.destroyed) {
    const timeOut = setTimeout(() => {
      const firstSequence = dataStorage.getSequence().firstSequence;
      const lastSequence = dataStorage.getSequence().lastSequence;
      if ((from >= firstSequence) && (from <= lastSequence)) {
        streamResponse(res, from, count, path, uuidCollection, boundary, acceptType, call);
        const fromValue = dataStorage.getSequence().nextSequence;
        return multiStreamSample(res, path, uuidCollection, freq, call, fromValue, boundary, count, acceptType);
      }
      clearTimeout(timeOut);
      const errorData = jsonToXML.createErrorResponse(instanceId, 'MULTIPART_STREAM', from);
      return giveStreamResponse(JSON.stringify(errorData), boundary, res, acceptType, 1);
    }, freq);
  }
  return;
}

/**
  * @parm {Number} interval - the ms delay needed between each stream. Eg: 1000
  */
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
    return errResponse(res, acceptType, 'validityCheck', obj.errorJSON);
    // return jsonToXML.jsonToXML(JSON.stringify(obj.errorJSON), res);
  } else if (call === 'sample') {
    const obj = validityCheck('sample', uuidCollection, path, sequenceId, count, freq);
    if (obj.valid) {
      res.setHeader('Connection', 'close'); // rewrite default value keep-alive
      res.writeHead(200, header1);
      streamResponse(res, sequenceId, count, path, uuidCollection, boundary, acceptType, call);
      const fromVal = dataStorage.getSequence().nextSequence;
      return multiStreamSample(res, path, uuidCollection, freq, call, fromVal, boundary, count, acceptType);
    }
    return errResponse(res, acceptType, 'validityCheck', obj.errorJSON);
    // return jsonToXML.jsonToXML(JSON.stringify(obj.errorJSON), res);
  }
  return log.error('Request Error');
  // TODO: ERROR INVALID request
}

/* **************************************** Request Handling ********************************************* */

/**
  * @param {Object} res - express.js response object
  * @param {Array} uuidCollection - list of uuids of all active device.
  * @param {String} acceptType - required output format - xml/json
  */

/**
  * handleProbeReq() - handles request with /probe
  */
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

/**
  * handleCurrentReq - handles request with /current
  * @param {String} call - current
  * @param {String} receivedPath - xpath - Eg: /current?path=//Axes//Linear//DataItem[@subType="ACTUAL"]&at=50
  * @param {String} device - the device of interest
  * @param {Array} uuidCollection - list of all the connected devices' uuid.
  * @param {String} acceptType - required output format - xml/json
  */
function handleCurrentReq(res, call, receivedPath, device, uuidCollection, acceptType) {
  queryError = false;
  // reqPath = /current?path=//Axes//Linear//DataItem[@subType="ACTUAL"]&at=50
  const reqPath = receivedPath;
  const sequenceId = checkAndGetParam(res, acceptType, reqPath, 'at', undefined, 1);
  let atExist = false;
  let path = checkAndGetParam(res, acceptType, reqPath, 'path', undefined, 0);
  let freq = checkAndGetParam(res, acceptType, reqPath, 'frequency', undefined, 1);

  if (sequenceId !== undefined) {
    atExist = true;
  }
  if (path !== undefined) {
    path = path.replace(/%22/g, '"'); // "device_name", "type", "subType"
  }
  if (freq === undefined) {
    freq = checkAndGetParam(res, acceptType, reqPath, 'interval', undefined, 1);
  }

  if ((freq !== undefined) && (!queryError)) {
    if (atExist) {
      return errResponse(res, acceptType, 'INVALID_REQUEST');
    }
    return handleMultilineStream(res, path, uuidCollection, freq, 'current', sequenceId, undefined, acceptType);
  }
  if (!queryError) {
    const obj = validityCheck('current', uuidCollection, path, sequenceId);

    if (obj.valid) {
      const jsonData = currentImplementation(res, acceptType, sequenceId, path, uuidCollection);
      return giveResponse(jsonData, acceptType, res);
    }
    // if obj.valid = false ERROR
    return errResponse(res, acceptType, 'validityCheck', obj.errorJSON);
  }
  return log.debug('QUERY_ERROR');
}

// TODO : move default value of count  100 to config
/**
  * handleSampleReq - handles request with /sample
  */
function handleSampleReq(res, call, receivedPath, device, uuidCollection, acceptType) {
  queryError = false;
  // eg: reqPath = /sample?path=//Device[@name="VMC-3Axis"]//Hydraulic&from=97&count=5
  const reqPath = receivedPath;
  const count = checkAndGetParam(res, acceptType, reqPath, 'count', 100, 1);
  let from = checkAndGetParam(res, acceptType, reqPath, 'from', undefined, 1);
  let path = checkAndGetParam(res, acceptType, reqPath, 'path', undefined, 0);
  let freq = checkAndGetParam(res, acceptType, reqPath, 'frequency', undefined, 1);
  if (path !== undefined) {
    path = path.replace(/%22/g, '"');
  }

  if (from === undefined) { // No from eg: /sample or /sample?path=//Axes
    const sequence = dataStorage.getSequence();
    from = sequence.firstSequence; // first sequenceId in CB
  }
  if (freq === undefined) {
    freq = checkAndGetParam(res, acceptType, reqPath, 'interval', undefined, 1);
  }
  if ((freq !== undefined) && (!queryError)) {
    return handleMultilineStream(res, path, uuidCollection, freq, 'sample', from, count, acceptType);
  }
  if (!queryError) {
    const obj = validityCheck('sample', uuidCollection, path, from, count);

    if (obj.valid) {
      const jsonData = sampleImplementation(res, acceptType, from, count, path, uuidCollection);
      return giveResponse(jsonData, acceptType, res);
    }
    // if obj.valid = false ERROR
    return errResponse(res, acceptType, 'validityCheck', obj.errorJSON);
  }
  return log.debug('QUERY_ERROR');
}

function getAssetList(receivedPath) {
  let reqPath = receivedPath;
  const firstIndex = reqPath.indexOf('/');
  let assetList;
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
  return assetList;
}



/* storeAsset */
function storeAsset(res, receivedPath, acceptType) {
  const reqPath = receivedPath;
  const body = res.req.body;
  const assetId = getAssetList(reqPath)[0];
  const type = checkAndGetParam(res, acceptType, reqPath, 'type', undefined, 0);
  const device = checkAndGetParam(res, acceptType, reqPath, 'device', undefined, 0);
  const uuidCollection = common.getAllDeviceUuids(devices);
  let uuid = common.getDeviceUuid(device);
  if ((uuid === undefined) && !R.isEmpty(uuidCollection)) {
    uuid = uuidCollection[0]; // default device
  } else if (R.isEmpty(uuidCollection)) {
    return errResponse(res, acceptType, 'NO_DEVICE', device);
  }
  const value = [];
  const jsonData = {
    time: '',
    dataitem: [],
  };
  value.push(assetId);
  value.push(type);

  if (body) {
    keys = R.keys(body);
    R.map((k) => {
      let time;
      if (k === 'time') {
        time = R.pluck(k, [body]);
        jsonData.time = time[0];
      }
      if (R.isEmpty(time)) {
        jsonData.time = moment.utc().format();
      }

      if (k === 'body') {
        const data = R.pluck(k, [body]);
        value.push(data[0]);
      }
    }, keys);
  }
  jsonData.dataitem.push({ name: 'addAsset', value: value });
  const status = lokijs.addToAssetCollection(jsonData, uuid);
  if (status) {
    res.send('<success/>\r\n');
  } else {
    res.send('<failed/>\r\n')
  }
  return;
}

/**
  * handleAssetReq() handle all asset request and calls assetImplementation if the request is valid
  * @param {Object} res
  * @param {String} receivedPath - /asset/assetId1;assetId2
  * @param {String} acceptType - specifies xml or json format for response
  * @param {String} deviceName - undefined or device of interest (Eg: 'VMC-3Axis')
  */

function handleAssetReq(res, receivedPath, acceptType, deviceName) {
  queryError = false;
  let reqPath = receivedPath; // Eg1:  /asset/assetId1;assetId2
                              // Eg2:  /assets
  const assetList = getAssetList(reqPath);

  const type = checkAndGetParam(res, acceptType, reqPath, 'type', undefined, 0);
  const count = checkAndGetParam(res, acceptType, reqPath, 'count', undefined, 0);
  const removed = checkAndGetParam(res, acceptType, reqPath, 'removed', false, 0);
  const target = checkAndGetParam(res, acceptType, reqPath, 'target', deviceName, 0);
  const archetypeId = checkAndGetParam(res, acceptType, reqPath, 'archetypeId', undefined, 0);
  if (!queryError) {
    return assetImplementation(res, assetList, type, count, removed, target, archetypeId, acceptType);
  }
  return log.debug('QUERY_ERROR');
}


/**
  * handleGet() handles http 'GET' request and calls function depending on the value of call
  * @param {Object} res - express.js response object
  * @param {String} call - current, sample or probe
  * @param {String} receivedPath - Eg1: '/mill-1/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic'
  * @param {String} device - device specified in request - mill-1 (from Eg1)
  * @param {String} acceptType - required output format - xml/json
  */
function handleCall(res, call, receivedPath, device, acceptType) {
  let uuidCollection;
  if (device === undefined) {
    uuidCollection = common.getAllDeviceUuids(devices);
  } else {
    uuidCollection = [common.getDeviceUuid(device)];
  }

  if (R.isEmpty(uuidCollection) || uuidCollection[0] === undefined) {
    return errResponse(res, acceptType, 'NO_DEVICE', device);
  }
  if (call === 'current') {
    return handleCurrentReq(res, call, receivedPath, device, uuidCollection, acceptType);
  } else if (call === 'probe') {
    return handleProbeReq(res, uuidCollection, acceptType);
  } else if (call === 'sample') {
    return handleSampleReq(res, call, receivedPath, device, uuidCollection, acceptType);
  } else if (call === 'asset' || call === 'assets') {
    // receivedPath: /VMC-3Axis/asset
    const editReceivedPath = receivedPath.slice(device.length + 1); // /asset
    return handleAssetReq(res, editReceivedPath, acceptType, device);
  }
  return errResponse(res, acceptType, 'UNSUPPORTED', receivedPath);
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
    return errResponse(res, undefined, errCategory, cdata);
  } else if (device === undefined) {
    device = adapter;
  }

  const uuidVal = common.getDeviceUuid(device);
  if (uuidVal === undefined) {
    cdata = `Cannot find device:${device}`;
    return errResponse(res, undefined, errCategory, cdata);
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
    if (req.method === "GET") {
      return handleAssetReq(res, receivedPath, acceptType);
    } else { // PUT or POST
      return storeAsset(res, receivedPath, acceptType);
    }
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
      return errResponse(res, acceptType, 'UNSUPPORTED', receivedPath);
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


function isPutEnabled(ip) {
  let isPresent = false;
  R.find((k) => {
    if (k === ip) {
      isPresent = true;
    }
  }, putAllowedHosts);
  return isPresent;
}
/**
  * requestErrorCheck() checks the validity of the request method
  * @param {Object} res
  * @param {String} method - 'GET', 'PUT, POST' etc
  * returns {Boolean} validity - true, false
  */
function requestErrorCheck(res, method, acceptType) {
  let ip = res.req.ip;
  let validity;
  let cdata = '';
  const ipStart = ip.search(/ffff:/);
  if (ipStart !== -1) {
    ip = ip.slice(ipStart + 5, Infinity);
  } else if (ip === '::1') {
    ip = 'localhost';
  }
  const errCategory = 'UNSUPPORTED_PUT';
  if (PUT_ENABLED) {
    if ((method === 'PUT' || method === 'POST') && (!R.isEmpty(putAllowedHosts)) && (!isPutEnabled(ip))) {
      validity = false;
      cdata = `HTTP PUT is not allowed from ${ip}`;
      return errResponse(res, acceptType, errCategory, cdata);
    }
    if (method !== 'GET' && method !== 'PUT' && method !== 'POST') {
      validity = false;
      cdata = 'Only the HTTP GET and PUT requests are supported';
      return errResponse(res, acceptType, errCategory, cdata);
    }
  } else {
    if (method !== 'GET') {
      validity = false;
      cdata = 'Only the HTTP GET request is supported';
      return errResponse(res, acceptType, errCategory, cdata);
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
  queryError = false;
  app.use(bodyParser.urlencoded({ extended: true, limit: 10000 }));
  app.use(bodyParser.json());

  app.all('*', (req, res) => {
    let acceptType;
    if (req.headers.accept) {
      acceptType = req.headers.accept;
    }
    const validRequest = requestErrorCheck(res, req.method, acceptType);
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
  storeAsset,
  processSHDR,
  getAdapterInfo,
  searchDevices,
  getDeviceXML,
};
