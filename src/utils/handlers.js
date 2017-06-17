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
const net = require('net')
const R = require('ramda')
const moment = require('moment')
// Imports - Internal
const lokijs = require('../lokijs')
const log = require('../config/logger')
const common = require('../common')
const dataStorage = require('../dataStorage')
const jsonToXML = require('../jsonToXML')
const md5 = require('md5')
const devices = require('../store')

// IgnoreTimestamps  - Ignores timeStamp with agent time.

const instanceId = common.getCurrentTimeInSec()
const c = new net.Socket() // client-adapter

/* *** Error Handling *** */
function errResponse (res, acceptType, errCode, value) {
  let errorData
  if (errCode === 'validityCheck') {
    errorData = value
  } else {
    errorData = jsonToXML.createErrorResponse(instanceId, errCode, value)
  }
  if (acceptType === 'application/json') {
    res.send(errorData)
    return ''
  }
  return jsonToXML.jsonToXML(JSON.stringify(errorData), res)
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
function validityCheck (call, uuidCollection, path, seqId, count, freq) {
  const errorJSON = jsonToXML.createErrorResponse(instanceId)
  let errorObj = errorJSON.MTConnectError.Errors
  const getSequence = dataStorage.getSequence()
  const firstSequence = getSequence.firstSequence
  const lastSequence = getSequence.lastSequence
  const bufferSize = dataStorage.getBufferSize()
  const maxFreq = 2147483646
  let valid = true
  if (path) {
    if (!lokijs.pathValidation(path, uuidCollection)) {
      valid = false
      errorObj = jsonToXML.categoriseError(errorObj, 'INVALID_XPATH', path)
    }
  }
  if (freq) {
    if ((freq < 0) || (!Number.isInteger(freq)) || (freq > maxFreq)) {
      valid = false
      errorObj = jsonToXML.categoriseError(errorObj, 'INTERVAL', freq)
    }
  }
  if (call === 'current') {
    if (seqId || seqId === 0) { // seqId = 0, check whether it is in range
      if ((seqId < firstSequence) || (seqId > lastSequence)) {
        valid = false
        errorObj = jsonToXML.categoriseError(errorObj, 'SEQUENCEID', seqId)
      }
    }
  } else {
    if ((seqId < 0) || (seqId < firstSequence) || (seqId > lastSequence) || isNaN(seqId)) {
      valid = false
      errorObj = jsonToXML.categoriseError(errorObj, 'FROM', seqId)
    }
    if ((count === 0) || (!Number.isInteger(count)) || (count < 0) || (count > bufferSize)) {
      valid = false
      errorObj = jsonToXML.categoriseError(errorObj, 'COUNT', count)
    }
  }
  const obj = {
    valid,
    errorJSON
  }
  return obj
}

/**
  * checkAndGetParam() checks whether the parameter is empty and get the value of the parameter if not empty
  * if empty it will give query error response
  *
  *
  */
function checkAndGetParam (res, acceptType, req, param, defaultVal, number) {
  const param1 = `${param}=`
  let rest
  let paramEnd
  if (req.includes(param1)) {
    const paramStart = req.search(param1)
    const length = param1.length
    const start = paramStart + length
    rest = req.slice(start)
  } else {
    return defaultVal
  }

  if (rest.includes('?') || rest.includes('&')) {
    paramEnd = rest.search(/(\?|&)/)
  } else {
    paramEnd = Infinity
  }
  let paramVal = rest.slice(0, paramEnd)
  if (paramVal === '') {
    return errResponse(res, acceptType, 'QUERY_ERROR', param)
  }
  if (number) {
    paramVal = Number(paramVal)
  }
  return paramVal
}

/**
  * giveResponse() creates the json or xml response for sample and current when no error is present
  * @param {Object} jsonData - jsonObject with requested dataItems (MTConnectStream)
  * @param {String} acceptType - 'application/json' (JSON format) or undefined (xml format)
  * @param {Object} res - to give response to browser
  *
  */
function giveResponse (jsonData, acceptType, res) {
  if (jsonData.length !== 0) {
    const completeJSON = jsonToXML.concatenateDeviceStreams(jsonData)
    if (acceptType === 'application/json') {
      res.send(completeJSON)
      return
    }
    jsonToXML.jsonToXML(JSON.stringify(completeJSON), res)
  }
}

/**
  * giveStreamResponse() gives the stream response in JSON or xml format
  * @param {Object} jsonStream - multipart stream data
  * @param {String} boundary - 32 bit tagline
  * @param {Object} res - http response object
  * @param {String} acceptType - specifies required format for response
  */
function giveStreamResponse (jsonStream, boundary, res, acceptType, isError) {
  if (acceptType === 'application/json') {
    const contentLength = jsonStream.length
    res.write(`--${boundary}\r\n`)
    res.write(`Content-type: text/xml\r\n`)
    res.write(`Content-length:${contentLength}\r\n\r\n`)
    res.write(`${jsonStream}\r\n`)
    if (isError) {
      res.write(`\r\n--${boundary}--\r\n`)
      res.end() // ends the connection
    }
  } else {
    jsonToXML.jsonToXMLStream(jsonStream, boundary, res, isError)
  }
}

/**
  * currentImplementation() creates the response for /current request
  * @param {Object} res - http response object
  * @param {Number} sequenceId - at value if specified in request/ undefined
  * @param {String} path - path specified in req Eg: path=//Axes//Rotary
  * @param {Array} uuidCollection - list of all the connected devices' uuid.
  */
function currentImplementation (res, acceptType, sequenceId, path, uuidCollection) {
  const jsonData = []
  let uuid
  let i = 0
  R.map((k) => {
    uuid = k
    const latestSchema = lokijs.searchDeviceSchema(uuid)
    const dataItemsArr = lokijs.getDataItem(uuid)
    const deviceName = lokijs.getDeviceName(uuid)
    if ((dataItemsArr === null) || (latestSchema === null)) {
      return errResponse(res, acceptType, 'NO_DEVICE', deviceName)
    }
    const dataItems = dataStorage.categoriseDataItem(latestSchema, dataItemsArr, sequenceId, uuid, path)
    jsonData[i++] = jsonToXML.updateJSON(latestSchema, dataItems, instanceId)
    return jsonData // eslint
  }, uuidCollection)
  return jsonData
}

/**
  * sampleImplementation() creates the response for /current request
  * @param {Object} res - http response object
  * @param {Number} from - from value if specified in request/ firstSequence
  * @param {String} path - path specified in req Eg: path=//Axes//Rotary
  * @param {Number} count - number of dataItems should be shown maximum.
  * @param {Array} uuidCollection - list of all the connected devices' uuid.
  */
function sampleImplementation (res, acceptType, from, count, path, uuidCollection) {
  const jsonData = []
  let uuid
  let i = 0
  R.map((k) => {
    uuid = k
    const latestSchema = lokijs.searchDeviceSchema(uuid)
    const dataItemsArr = lokijs.getDataItem(uuid)
    const deviceName = lokijs.getDeviceName(uuid)
    if ((dataItemsArr === null) || (latestSchema === null)) {
      return errResponse(res, acceptType, 'NO_DEVICE', deviceName)
    }
    const dataItems = dataStorage.categoriseDataItem(latestSchema, dataItemsArr, from, uuid, path, count)
    jsonData[i++] = jsonToXML.updateJSON(latestSchema, dataItems, instanceId, 'SAMPLE')
    return jsonData
  }, uuidCollection)
  return jsonData
}

/**
  * validateAssetList() - checks whether the specified assetids in request are valid
  * @param {Array} arr - array of assetIds
  * return {object} obj - { assetId, status }
  *
  */
function validateAssetList (arr) {
  const baseArr = lokijs.getAssetCollection()
  let valid
  let obj
  for (let i = 0; i < arr.length; i++) {
    valid = false
    for (let j = 0; j < baseArr.length; j++) {
      if (arr[i] === baseArr[j]) {
        valid = true
      }
    }
    if (!valid) {
      obj = { assetId: arr[i], status: false }
      return obj
    }
  }
  obj = { assetId: 'all', status: true }
  return obj
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
function assetImplementationForAssets (res, type, count, removed, target, archetypeId, acceptType) {
  const assetCollection = lokijs.getAssetCollection()
  let assetItem
  const assetData = []
  let i = 0
  if (!R.isEmpty(assetCollection)) {
    assetItem = dataStorage.readAssets(assetCollection, type, Number(count), removed, target, archetypeId)
    assetData[i++] = jsonToXML.createAssetResponse(instanceId, assetItem)
    const completeJSON = jsonToXML.concatenateAssetswithIds(assetData)
    if (acceptType === 'application/json') {
      res.send(completeJSON)
      return
    }
    jsonToXML.jsonToXML(JSON.stringify(completeJSON), res)
    return
  } // empty asset Collection
  assetData[i++] = jsonToXML.createAssetResponse(instanceId, { }) // empty asset response
  const completeJSON = jsonToXML.concatenateAssetswithIds(assetData)
  if (acceptType === 'application/json') {
    res.send(completeJSON)
    return
  }
  jsonToXML.jsonToXML(JSON.stringify(completeJSON), res)
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
function assetImplementation (res, assetList, type, count, removed, target, archetypeId, acceptType) {
  let valid = {}
  const assetData = []
  let i = 0
  if (!assetList) {
    return assetImplementationForAssets(res, type, count, removed, target, archetypeId, acceptType)
  }
  const assetCollection = assetList
  valid = validateAssetList(assetCollection)
  if (valid.status && !R.isEmpty(assetCollection)) {
    R.map((k) => {
      const assetItem = dataStorage.readAssetforId(k)
      assetData[i++] = jsonToXML.createAssetResponse(instanceId, assetItem)
      return k
    }, assetCollection)
    const completeJSON = jsonToXML.concatenateAssetswithIds(assetData)
    if (acceptType === 'application/json') {
      return res.send(completeJSON)
    }
    return jsonToXML.jsonToXML(JSON.stringify(completeJSON), res)
  }
  return errResponse(res, acceptType, 'ASSET_NOT_FOUND', valid.assetId)
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
function streamResponse (res, seqId, count, path, uuidCollection, boundary, acceptType, call) {
  let jsonData = ''
  if (call === 'current') {
    jsonData = currentImplementation(res, acceptType, seqId, path, uuidCollection)
  } else {
    jsonData = sampleImplementation(res, acceptType, seqId, count, path, uuidCollection)
  }

  if (jsonData.length !== 0) {
    const completeJSON = jsonToXML.concatenateDeviceStreams(jsonData)
    const jsonStream = JSON.stringify(completeJSON)
    giveStreamResponse(jsonStream, boundary, res, acceptType, 0)
  }
}

// recursive function for current
function multiStreamCurrent (ctx, path, uuidCollection, freq, call, sequenceId, boundary, acceptType) {
  if (!ctx.req.client.destroyed) {
    setTimeout(() => {
      streamResponse(ctx.res, sequenceId, 0, path, uuidCollection, boundary, acceptType, call)
      return multiStreamCurrent(ctx, path, uuidCollection, freq, call, sequenceId, boundary, acceptType)
    }, freq)
  }
}

// recursive function for sample, from updated on each call with nextSequence
function multiStreamSample (ctx, path, uuidCollection, freq, call, from, boundary, count, acceptType) {
  if (!ctx.req.client.destroyed) {
    const timeOut = setTimeout(() => {
      const firstSequence = dataStorage.getSequence().firstSequence
      const lastSequence = dataStorage.getSequence().lastSequence
      if ((from >= firstSequence) && (from <= lastSequence)) {
        streamResponse(ctx.res, from, count, path, uuidCollection, boundary, acceptType, call)
        const fromValue = dataStorage.getSequence().nextSequence
        return multiStreamSample(ctx, path, uuidCollection, freq, call, fromValue, boundary, count, acceptType)
      }
      clearTimeout(timeOut)
      const errorData = jsonToXML.createErrorResponse(instanceId, 'MULTIPART_STREAM', from)
      return giveStreamResponse(JSON.stringify(errorData), boundary, ctx.res, acceptType, 1)
    }, freq)
  }
}

/**
  * @parm {Number} interval - the ms delay needed between each stream. Eg: 1000
  */
function handleMultilineStream (ctx, path, uuidCollection, interval, call, sequenceId, count, acceptType) {
  // Header
  const { res } = ctx
  const boundary = md5(moment.utc().format())
  const time = new Date()
  const header1 = {
    'Date': time.toUTCString(),
    'Server': 'MTConnectAgent',
    //'Status': '200 OK',
    'Expires': -1,
    'Cache-Control': 'private, max-age=0',
    //'Content-Disposition': 'inline',
    'Content-Type': `multipart/x-mixed-replace:boundary=${boundary}`,
    'Transfer-Encoding': 'chunked'
  }
  // const header1 = 'HTTP/1.1 200 OK\r\n' +
  //                 `Date: ${time.toUTCString()}\r\n` +
  //                 'Server: MTConnectAgent\r\n' +
  //                 'Expires: -1\r\n' +
  //                 'Connection: close\r\n' +
  //                 'Cache-Control: private, max-age=0\r\n' +
  //                 `Content-Type: multipart/x-mixed-replace;boundary=${boundary}` +
  //                 'Transfer-Encoding: chunked\r\n\r\n' // comment this line to remove chunk size from appearing
  const freq = Number(interval)
  if (call === 'current') {
    const obj = validityCheck('current', uuidCollection, path, sequenceId, 0, freq)
    if (obj.valid) {
      res.setHeader('Connection', 'close') // rewrite default value keep-alive
      res.writeHead(200, header1)
      streamResponse(res, sequenceId, 0, path, uuidCollection, boundary, acceptType, call)
      return multiStreamCurrent(ctx, path, uuidCollection, freq, call, sequenceId, boundary, acceptType)
    }
    return errResponse(res, acceptType, 'validityCheck', obj.errorJSON)
    // return jsonToXML.jsonToXML(JSON.stringify(obj.errorJSON), res);
  } else if (call === 'sample') {
    const obj = validityCheck('sample', uuidCollection, path, sequenceId, count, freq)
    if (obj.valid) {
      res.setHeader('Connection', 'close') // rewrite default value keep-alive
      res.writeHead(200, header1)
      streamResponse(res, sequenceId, count, path, uuidCollection, boundary, acceptType, call)
      const fromVal = dataStorage.getSequence().nextSequence
      return multiStreamSample(ctx, path, uuidCollection, freq, call, fromVal, boundary, count, acceptType)
    }
    return errResponse(res, acceptType, 'validityCheck', obj.errorJSON)
    // return jsonToXML.jsonToXML(JSON.stringify(obj.errorJSON), res);
  }
  return log.error('Request Error')
  // TODO: ERROR INVALID request
}

/* **************************************** Request Handling ********************************************* */

function getAssetList (receivedPath) {
  let reqPath = receivedPath
  const firstIndex = reqPath.indexOf('/')
  let assetList
  reqPath = reqPath.slice(firstIndex + 1) // Eg1: asset/assetId1;assetId2;
  if (reqPath.includes('/')) { // check for another '/'
    const index = reqPath.lastIndexOf('/') + 1
    assetList = reqPath.slice(index, Infinity)
    if (assetList.includes(';')) {
      assetList = assetList.split(';') // array of assetIds = [assetId1, assetId2]
    } else if (assetList.includes('?')) {
      const qm = assetList.indexOf('?') // Eg: reqPath = /asset/assetId?type="CuttingTool"
      assetList = [assetList.slice(0, qm)] // one id created to array, [assetId]
    } else {
      assetList = [assetList]
    }
  }
  return assetList
}

/* storeAsset */
// Possibly never used
// * can't find a reverence in the doc)
function storeAsset (res, receivedPath, acceptType) {
  const reqPath = receivedPath
  const body = res.req.body
  const assetId = getAssetList(reqPath)[0]
  const type = checkAndGetParam(res, acceptType, reqPath, 'type', undefined, 0)
  const device = checkAndGetParam(res, acceptType, reqPath, 'device', undefined, 0)
  const uuidCollection = common.getAllDeviceUuids(devices)
  let uuid = common.getDeviceUuid(device)
  if ((uuid === undefined) && !R.isEmpty(uuidCollection)) {
    uuid = uuidCollection[0] // default device
  } else if (R.isEmpty(uuidCollection)) {
    return errResponse(res, acceptType, 'NO_DEVICE', device)
  }
  const value = []
  const jsonData = {
    time: '',
    dataitem: []
  }
  value.push(assetId)
  value.push(type)
  let keys
  if (body) {
    keys = R.keys(body)
    R.forEach((k) => {
      let time
      if (k === 'time') {
        time = R.pluck(k, [body])
        jsonData.time = time[0]
      }
      if (R.isEmpty(time)) {
        jsonData.time = moment.utc().format()
      }

      if (k === 'body') {
        const data = R.pluck(k, [body])
        value.push(data[0])
      }
    }, keys)
  }
  jsonData.dataitem.push({ name: 'addAsset', value })
  const status = lokijs.addToAssetCollection(jsonData, uuid)
  if (status) {
    res.send('<success/>\r\n')
  } else {
    res.send('<failed/>\r\n')
  }
  return ''
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
function handlePut (adapter, receivedPath, deviceName) {
  const { res, req } = this
  let device = deviceName
  const { body } = this.request
  const errCategory = 'UNSUPPORTED_PUT'
  let cdata = ''
  if (device === undefined && adapter === undefined) {
    cdata = 'Device must be specified for PUT'
    return errResponse(res, undefined, errCategory, cdata)
  } else if (device === undefined) {
    device = adapter
  }

  const uuidVal = common.getDeviceUuid(device)
  if (uuidVal === undefined) {
    cdata = `Cannot find device:${device}`
    return errResponse(res, undefined, errCategory, cdata)
  }

  //
  if (R.hasIn('_type', body) && (R.pluck('_type', [body])[0] === 'command')) {
    console.log(`\r\n\r\ndeviceName${device}deviceNameEnd`)
    const keys = R.keys(req.body)
    for (let i = 0; i < devices.data.length; i++) {
      console.log(`port${devices.data[i].port}portEnd`)
      R.each((k) => {
        const value = R.pluck(k, [body])[0]
        const command = `${k}=${value}`
        console.log(`Sending command ${command} to ${device}`)
        c.write(`*${command}\n`)
      }, keys)
    }
  } else {
    const keys = R.keys(body)
    const jsonData = {
      time: '',
      dataitem: []
    }
    jsonData.time = moment.utc().format()

    R.map((k) => {
      const data = R.pluck(k, [body])
      if (k === 'time') {
        jsonData.time = data
      } else {
        jsonData.dataitem.push({ name: k, value: data[0] })
      }
      return jsonData
    }, keys)

    lokijs.dataCollectionUpdate(jsonData, uuidVal)
  }
  this.body = '<success/>\r\n'
  return true
}

/**
  * handleRequest() classifies depending on the request method or assets
  * and call handleGet(), handlePut or handleAssetReq
  * @param {Object} req
  * @param {Object} res
  * returns null
  */
function * handleRequest () {
  const { req, res } = this
  const acceptType = req.headers.accept
  // '/mill-1/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic'
  const receivedPath = req.url
  let device
  let end = Infinity
  let call
  // 'mill-1/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic'
  let reqPath = receivedPath.slice(1, receivedPath.length)
  const qm = reqPath.lastIndexOf('?') // 13
  if (qm !== -1) { // if ? found
    reqPath = reqPath.substring(0, qm) // 'mill-1/sample'
  }
  const loc1 = reqPath.search('/')     // 6
  if (loc1 !== -1) {
    end = loc1
  }
  const first = reqPath.substring(0, end) // 'mill-1'

   // If a '/' was found
  if (loc1 !== -1) {
    const loc2 = reqPath.includes('/', loc1 + 1) // check for another '/'
    if (loc2) {
      let nextString = reqPath.slice(loc1 + 1, Infinity)
      const nextSlash = nextString.search('/')
      nextString = nextString.slice(0, nextSlash)
      return errResponse(res, acceptType, 'UNSUPPORTED', receivedPath)
    }
    device = first
    call = reqPath.substring(loc1 + 1, Infinity)
  } else {
    // Eg: if reqPath = '/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic'
    call = first // 'sample'
  }
  return handlePut.call(this, call, receivedPath, device, acceptType)
}

function isPutEnabled (ip, AllowPutFrom) {
  return R.find(k => k === ip)(AllowPutFrom)
}

function parseIP () {
  return function * doParseIP (next) {
    let ip = this.req.connection.remoteAddress
    const head = /ffff:/
    if ((head).test(ip)) {
      ip = ip.replase(head, '')
    } else if (ip === '::1') {
      ip = 'localhost'
    }
    this.mtc.ip = ip
    yield next
  }
}

/**
  * validRequest() checks the validity of the request method
  * @param {Object} req
  * @param {Object} res
  * @param {String} method - 'GET', 'PUT, POST' etc
  */
function validRequest ({ AllowPutFrom, allowPut }) {
  return function * validateRequest (next) {
    let cdata = ''
    const { method, res, req } = this

    const errCategory = 'UNSUPPORTED_PUT'
    if (allowPut) {
      if ((method === 'PUT' || method === 'POST') && (!isPutEnabled(this.mtc.ip, AllowPutFrom))) {
        cdata = `HTTP PUT is not allowed from ${this.mtc.ip}`
        return errResponse(res, req.headers.accept, errCategory, cdata)
      }
      if (method !== 'GET' && method !== 'PUT' && method !== 'POST') {
        cdata = 'Only the HTTP GET and PUT requests are supported'
        return errResponse(res, req.headers.accept, errCategory, cdata)
      }
    } else {
      if (method !== 'GET') {
        cdata = 'Only the HTTP GET request is supported'
        return errResponse(res, req.headers.accept, errCategory, cdata)
      }
    }
    return yield next
  }
}

function logging () {
  return function * doLogging (next) {
    log.debug(`Request ${this.method} from ${this.host}:`)
    const startT = new Date()
    yield next
    const ms = new Date() - startT
    log.debug('%s %s - %s', this.method, this.url, ms)
  }
}

module.exports = {
  validityCheck,
  checkAndGetParam,
  giveResponse,
  giveStreamResponse,
  currentImplementation,
  sampleImplementation,
  validateAssetList,
  assetImplementationForAssets,
  assetImplementation,
  streamResponse,
  multiStreamCurrent,
  multiStreamSample,
  handleMultilineStream,
  getAssetList,
  storeAsset,
  handlePut,
  handleRequest,
  isPutEnabled,
  validRequest,
  parseIP,
  logging,
  errResponse
}
