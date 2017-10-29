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

const stream = require('stream')
const through = require('through')
const moment = require('moment')
const R = require('ramda')
const md5 = require('md5')
const xml2js = require('xml2js')
const converter = require('converter')

// Imports - Internal
const dataStorage = require('./dataStorage')
const lokijs = require('./lokijs')
const log = require('./config/logger')
const dataitemjs = require('./dataItem')
const componentjs = require('../src/utils/component')

//const
const builder = new xml2js.Builder()

/* ********* Helper functions to recreate the heirarchial structure *************** */
/**
  * findDataItemForSample() gives array of DataItem entries in
  * the required time bound which match the id for Sample request.
  *
  * @param {Object} arr - all dataItems in the timebound
  * @param {String} id - the id of dataitem required.
  */
function findDataItemForSample (arr, id) {
  let typeArr
  let res
  for (let i = 0; i < arr.length; i++) {
    typeArr = arr[i]
    const key = R.keys(typeArr[0])
    const pluckedData = (R.pluck(key, typeArr))
    if (pluckedData.length !== 0) {
      if (pluckedData[0].$.dataItemId === id) {
        res = typeArr
      }
    }
  }
  return res
}

/**
  * findDataItem() gives array of DataItem entries match the id.
  *
  * @param {Object} arr - dataItems
  * @param {String} id - the id of dataitem required
  * @param {String} reqType - 'SAMPLE' when the request is SAMPLE
  */

//return array
function findDataItem (arr, id, reqType) {
  const items = []

  let res
  if (reqType === 'SAMPLE') {
    res = findDataItemForSample(arr, id)
    if(res){
      items.push(res) 
    } 
    return items
  }
  
  for (let i = 0; i < arr.length; i++) {
    const keys = R.keys(arr[i])
    // k are the keys Eg: Availability, Load etc
    R.find((k) => {
    // pluck the properties of all objects corresponding to k
      if ((R.pluck(k, [arr[i]])) !== undefined) {
        const pluckedData = (R.pluck(k, [arr[i]]))[0] // result will be an array
        if (pluckedData.length !== 0) {
          if (pluckedData.$.dataItemId === id) {
            items.push(arr[i])
          }
        }
      }
      return items // to make eslint happy
    }, keys)
  }

  return items
}

/**
  * parseCategorisedArray() populates array of Category from the dataItems received.
  *
  * @param {Object} category - EVENT, SAMPLE or CONDITION.
  * @param {String} id - the id of dataitem required.
  * @param {Array} DataItemVar - DataItems of a device updated with values
  *                               with each category as seperate object.
  * @param {String} reqType - 'SAMPLE' when the request is SAMPLE
  */
function parseCategorisedArray (category, id, DataItemVar, reqType) {
  if (category === 'EVENT') {
    const arr = DataItemVar.Event
    const result = findDataItem(arr, id, reqType)
    return result
  } else if (category === 'SAMPLE') {
    const arr = DataItemVar.Sample
    const result = findDataItem(arr, id, reqType)
    return result
  } // category === CONDITION
  const arr = DataItemVar.Condition
  const result = findDataItem(arr, id, reqType)
  return result
}

/**
  * parseDataItems
  * @param dataItems - DataItems from device schema
  * [ { DataItem: [ { '$':{ type: 'AVAILABILITY',category: 'EVENT',id: 'dtop_2',
                            name: 'avail' } },
                    { '$': { type:,category:,id:,name: } } ] } ]
  * @param {Object} DataItemvar - DataItems of a device updated with values
  *                               with each category as seperate object.
  * @param {String} reqType -'SAMPLE' or undefined
  * return obj with eventArr, sampleArr, conditionArr in the required response format.
  */
function parseDataItems (dataItems, DataItemVar, reqType) {
  const sampleArr = []
  const conditionArr = []
  const eventArr = []
  const obj = {}
  for (let k = 0; k < dataItems.length; k++) {
    const dataItem = dataItems[k].DataItem
    for (let l = 0, m = 0, n = 0, p = 0; l < dataItem.length; l++) {
      const id = dataItem[l].$.id
      const category = dataItem[l].$.category
      if (category === 'EVENT') {
        const tempEvent = parseCategorisedArray(category, id, DataItemVar, reqType)[0]
        if (tempEvent !== undefined) {
          eventArr[p++] = tempEvent
        }
      }
      if (category === 'SAMPLE') {
        const tempSample = parseCategorisedArray(category, id, DataItemVar, reqType)[0]
        if (tempSample !== undefined) {
          sampleArr[m++] = tempSample
        }
      }
      if (category === 'CONDITION') {
        const tempCondition = parseCategorisedArray(category, id, DataItemVar, reqType)
        if (tempCondition !== undefined && !R.isEmpty(tempCondition)) {
          R.map((item) => {
            conditionArr[n++] = item
          }, tempCondition)   
        }
      }
    }
  }
  obj.eventArr = eventArr
  obj.sampleArr = sampleArr
  obj.conditionArr = conditionArr
  return obj
}



/**
  *
  * @param {Object} obj with eventArr, sampleArr, conditionArr in the required response format.
  * { eventArr: [ { Availability: { '$': { dataItemId: '', sequence: ,
  *              timestamp:, name:  },_: value } },
  *             { EmergencyStop: ....}, ...],
  *   sampleArr: [],
  *   conditionArr: [] }
  * @param {String} componentName - container name
  * @param {String} name - name of the component
  * @param {String} id - id of the component
  * @param {Object} componentObj - pointer to ComponentStreams
  */

function createComponentStream (obj, componentName, name, id, componentObj) {
  const eventArr = obj.eventArr
  const conditionArr = obj.conditionArr
  const sampleArr = obj.sampleArr
  const componentObj1 = componentObj
  let len = 0

  if (sampleArr.length !== 0 || eventArr.length !== 0 || conditionArr.length !== 0) {
    const title = { $: { component: componentName,
      name,
      componentId: id } }
    componentObj.push(title)
  }
  if (sampleArr.length !== 0) {
    len = componentObj.length - 1
    componentObj1[len].Samples = []
    componentObj1[len].Samples.push(sampleArr)
  }
  if (eventArr.length !== 0) {
    len = componentObj.length - 1
    componentObj1[len].Events = []
    componentObj1[len].Events.push(eventArr)
  }
  if (conditionArr.length !== 0) {
    len = componentObj.length - 1
    componentObj1[len].Condition = []
    componentObj1[len].Condition.push(conditionArr)
  }
}

/**
  * parseLevelSix parse the Dataitems and Components and pass to next function.
  * @param {Object} container - Axes, Controller, Systems objects.
  * @param {String} componentName - 'Axes', 'Controller', 'Systems'
  * @param {Object} componentObj - pointer to ComponentStreams
  * @param {Object} DataItemvar - DataItems of a device updated with values
  *                               with each category as seperate object.
  * @param {String} reqType - 'SAMPLE' or undefined
  *
  */
function parseLevelSix (container, componentObj, DataItemVar, reqType) {
  for (let i = 0; i < container.length; i++) {
    const keys = R.keys(container[i])
    R.find((k) => {
      const pluckedData = (R.pluck(k)([container[i]]))[0] // result will be an array
      const componentName = k
      for (let j = 0; j < pluckedData.length; j++) {
        const name = pluckedData[j].$.name
        const id = pluckedData[j].$.id
        
        if(pluckedData[j].DataItems !== undefined){
          const dataItems = pluckedData[j].DataItems
          const obj = parseDataItems(dataItems, DataItemVar, reqType)
          createComponentStream(obj, componentName, name, id, componentObj)
        }
      }
      return 0 // to make eslint happy
    }, keys)
  }
}

/**
  * parseLevelFive parse the Dataitems and Components and pass to next function.
  * @param {Object} container - Axes, Controller, Systems objects.
  * @param {String} componentName - 'Axes', 'Controller', 'Systems'
  * @param {Object} componentObj - pointer to ComponentStreams
  * @param {Object} DataItemvar - DataItems of a device updated with values
  *                               with each category as seperate object.
  * @param {String} reqType - 'SAMPLE' or undefined
  *
  */
function parseLevelFive (container, componentName, componentObj, DataItemVar, reqType) {
  for (let j = 0; j < container.length; j++) {
    const name = container[j].$.name
    const id = container[j].$.id

    if (container[j].DataItems !== undefined) {
      const dataItems = container[j].DataItems
      const obj = parseDataItems(dataItems, DataItemVar, reqType)
      createComponentStream(obj, componentName, name, id, componentObj, reqType)
    }

    if (container[j].Components !== undefined) {
      parseLevelSix(container[j].Components, componentObj, DataItemVar, reqType)
    }
    return
  }
}

/**
  * calculate sequence calculates the firstSequence, lastSequence and nextSequence
  * @param {String} reqType - 'SAMPLE' or undefined
  * return obj with keys firstSequence, lastSequence, nextSequence
  *
  */
function calculateSequence (reqType) {
  let nextSequence

  const getSequence = dataStorage.getSequence()
  const firstSequence = getSequence.firstSequence
  const lastSequence = getSequence.lastSequence

  if (reqType === 'SAMPLE') {
    const temp = getSequence.nextSequence
    nextSequence = temp
  } else {
    nextSequence = lastSequence + 1
  }
  const obj = {
    firstSequence,
    lastSequence,
    nextSequence
  }
  return obj
}

/* ****************** JSON Creation for Sample and Current ******************************* */

/**
  * updateJSON() creates a JSON object with corresponding data values.
  *
  * @param {Object} latestSchema - latest device schema
  * @param {Object} DataItemvar - DataItems of a device updated with values
  *                               with each category as seperate object.
  *
  * { Event:[ { Availability:{ '$':{ dataItemId:,sequence:,timestamp:,name: },_: value } },
  *            { EmergencyStop:{}...},...],
  *    Sample: [],
  *    Condition: [] }
  * @param {String} reqType -'SAMPLE' or undefined.
  * returns the JSON object with all values
  */
function updateJSON (latestSchema, DataItemVar, instanceId, reqType, referencesItems) {
  const xmlns = latestSchema[0].xmlns.xmlns
  const arr = xmlns.split(':')
  const version = arr[arr.length - 1]
  const newTime = moment.utc().format()
  const dvcHeader = latestSchema[0].device.$

  const sequence = calculateSequence(reqType)
  const firstSequence = sequence.firstSequence
  const lastSequence = sequence.lastSequence
  const nextSequence = sequence.nextSequence
  const DataItems = latestSchema[0].device.DataItems
  const Components = latestSchema[0].device.Components
  let componentName
  let newJSON = {}

  const newXMLns = { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    xmlns: `urn:mtconnect.org:MTConnectStreams:${version}`,
    'xmlns:m': `urn:mtconnect.org:MTConnectStreams:${version}`,
    'xsi:schemaLocation': `urn:mtconnect.org:MTConnectStreams:${version} http://schemas.mtconnect.org/schemas/MTConnectStreams_${version}.xsd` }

  newJSON = { MTConnectStreams:
  { $: newXMLns,
    Header:
    [{ $:
    { creationTime: newTime,
      assetBufferSize: dataStorage.assetBuffer.size,
      sender: 'localhost',
      assetCount: dataStorage.assetBuffer.length,
      version,
      instanceId,
      bufferSize: dataStorage.bufferSize,
      nextSequence,
      firstSequence,
      lastSequence } }],
    Streams:
    [{ DeviceStream:
    [{ $: { name: dvcHeader.name, uuid: dvcHeader.uuid },
      ComponentStreams: []
    }] }] } }

  const componentObj = newJSON.MTConnectStreams.Streams[0].DeviceStream[0].ComponentStreams
  if ((R.isEmpty(DataItemVar.Event)) && (R.isEmpty(DataItemVar.Sample)) &&
  (R.isEmpty(DataItemVar.Condition))) {
    log.debug('Empty')
    return newJSON
  }

  if (DataItems !== undefined) {
    componentName = 'Device'
    const id = latestSchema[0].device.$.id
    const name = latestSchema[0].device.$.name
    const obj = parseDataItems(DataItems, DataItemVar, reqType)
    createComponentStream(obj, componentName, name, id, componentObj)
  }

  if (Components !== undefined) {
    R.map((component) => {
      const keys = R.keys(component)
      R.map((key) => {
        componentName = key
        parseLevelFive(component[key], componentName, componentObj, DataItemVar, reqType)
      }, keys)
    }, Components)
  }

  if(referencesItems !== undefined && !R.isEmpty(referencesItems)){
    let obj = {}
    R.map((item) => {
      const { componentName, componentDetails, categorisedDataItems } = item
      obj.eventArr = categorisedDataItems.Event
      obj.sampleArr = categorisedDataItems.Sample
      obj.conditionArr = categorisedDataItems.Condition
      createComponentStream(obj, componentName, componentDetails.name, componentDetails.id, componentObj)
    }, referencesItems)
  }
  return newJSON
}

/* ************************* JSON creation for Errors ************************** */

function invalidPathError (path, errorObj) {
  const errObj = errorObj
  let len = errObj.length - 1

  if (errObj.length === 0 || errObj[len].Error === undefined) {
    const title = { $: { } }
    errObj.push(title)
    len = errObj.length - 1
    errObj[len].Error = []
  }

  const CDATA = `The path could not be parsed. Invalid syntax: ${path}.`
  const obj = { $:
  {
    errorCode: 'INVALID_XPATH'
  },
    _: CDATA
  }
  errObj[len].Error.push(obj)
  return errObj
}

function fromError (from, errorObj) {
  const param = '\'from\''
  const sequence = dataStorage.getSequence()
  const firstSequence = sequence.firstSequence
  const lastSequence = sequence.lastSequence
  let CDATA
  let errorCode = 'OUT_OF_RANGE'
  const errObj = errorObj
  let len = errObj.length - 1

  if (errObj.length === 0 || errObj[len].Error === undefined) {
    const title = { $: { } }
    errObj.push(title)
    len = errObj.length - 1
    errObj[len].Error = []
  }

  if (!Number.isInteger(from)) {
    CDATA = `${param} must be a positive integer.`
  } else if (from < 0) {
    CDATA = `${param} must be a positive integer.`
  } else if (from === 0) {
    errorCode = 'INVALID_REQUEST'
    CDATA = `${param} must be greater than zero.`
  } else if (from < firstSequence) {
    CDATA = `${param} must be greater than or equal to ${firstSequence}.`
  } else { // if (from > lastSequence)
    CDATA = `${param} must be less than or equal to ${lastSequence}.`
  }

  const obj = { $: { errorCode }, _: CDATA }
  errObj[len].Error.push(obj)
  return errObj
}

function freqError (freq, errorObj) {
  const param = '\'interval\''
  const errObj = errorObj
  const maxFreq = 2147483646
  let len = errObj.length - 1
  let CDATA

  if (errObj.length === 0 || errObj[len].Error === undefined) {
    const title = { $: { } }
    errObj.push(title)
    len = errObj.length - 1
    errObj[len].Error = []
  }
  if (!Number.isInteger(freq)) {
    CDATA = `${param} must be a positive integer.`
  }

  if (freq < 0) {
    CDATA = `${param} must be a positive integer.`
  }

  if (freq > maxFreq) {
    CDATA = `${param} must be greater than or equal to ${maxFreq}.`
  }

  const obj = { $:
  {
    errorCode: 'OUT_OF_RANGE'
  },
    _: CDATA
  }
  errObj[len].Error.push(obj)
  return errObj
}

function countError (count, errorObj) {
  const param = '\'count\''
  const bufferSize = dataStorage.getBufferSize()
  const errObj = errorObj
  let len = errObj.length - 1
  let errorCode = 'OUT_OF_RANGE'
  let CDATA

  if (errObj.length === 0 || errObj[len].Error === undefined) {
    const title = { $: { } }
    errObj.push(title)
    len = errObj.length - 1
    errObj[len].Error = []
  }

  if (!Number.isInteger(count)) {
    CDATA = `${param} must be a positive integer.`
  }

  if (count < 0) {
    CDATA = `${param} must be a positive integer.`
  }

  if (count === 0) {
    errorCode = 'INVALID_REQUEST'
    CDATA = `${param} must be greater than or equal to 1.`
  }

  if (count > bufferSize) {
    CDATA = `${param} must be less than or equal to ${bufferSize}.`
  }

  const obj = { $: { errorCode }, _: CDATA }
  errObj[len].Error.push(obj)
  return errObj
}

/**
  * sequenceIdError() creates the CDATA and errorCode for
  * when given sequenceId is out of range and append it to Errors
  * @param {Number} sequenceId (received in request)
  * @param {Object} errObj
  *
  */

function sequenceIdError (sequenceId, errorObj) {
  const param = '\'at\''
  const sequenceObj = dataStorage.getSequence()
  const firstSeq = Number(sequenceObj.firstSequence)
  const lastSeq = Number(sequenceObj.lastSequence)
  const errObj = errorObj
  let len = errObj.length - 1
  if (errObj.length === 0 || errObj[len].Error === undefined) {
    const title = { $: { } }
    errObj.push(title)
    len = errObj.length - 1
    errObj[len].Error = []
  }
  let CDATA
  if (sequenceId < 0) {
    CDATA = `${param} must be a positive integer.`
  } else if (sequenceId < firstSeq) {
    CDATA = `${param} must be greater than or equal to ${firstSeq}.`
  } else {
    CDATA = `${param} must be less than or equal to ${lastSeq}.`
  }
  const obj = { $:
  {
    errorCode: 'OUT_OF_RANGE'
  },
    _: CDATA
  }
  errObj[len].Error.push(obj)
  return errObj
}

/**
  * singleError() creates the CDATA and errorCode for
  * when the requested device is not present and append it to Errors
  * @param {Number} sequenceId (received in request)
  * @param {Object} errObj
  *
  */
function singleError (errorObj, CDATA, errorCode) {
  const title = { $: { } }
  const errObj = errorObj
  errObj.push(title)
  const len = errObj.length - 1
  errObj[len].Error = []
  const obj = { $:
  {
    errorCode
  },
    _: CDATA
  }
  errObj[len].Error.push(obj)
}

/**
  * createErrorResponse() creates MTConnectError response
  * @param {Object} latestSchema
  * @param {String} errCategory (given to use this as a generic function)
  * @param {Any} value (depends on the errCategory)
  */
function createErrorResponse (instanceId, errCategory, value) {
  // const xmlns = latestSchema[0].xmlns.xmlns;
  // const arr = xmlns.split(':');
  const version = 1.3  // arr[arr.length - 1]; //TODO: move to config
  const newTime = moment.utc().format()

  const newXMLns = { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    xmlns: `urn:mtconnect.org:MTConnectError:${version}`,
    'xmlns:m': `urn:mtconnect.org:MTConnectError:${version}`,
    'xsi:schemaLocation': `urn:mtconnect.org:MTConnectError:${version} http://schemas.mtconnect.org/schemas/MTConnectError_${version}.xsd` }

  let errorJSON = {}
  errorJSON = { MTConnectError:
  { $: newXMLns,
    Header:
    [{ $:
    { creationTime: newTime,
      sender: 'localhost',
      instanceId,
      bufferSize: dataStorage.getBufferSize(),
      version
    } }],
    Errors: []
  }
  }
  const errorObj = errorJSON.MTConnectError.Errors
  let CDATA
  let errorCode
  if (errCategory === 'NO_DEVICE') {
    CDATA = `Could not find the device ${value}.`
    errorCode = 'NO_DEVICE'
    singleError(errorObj, CDATA, errorCode)
  }

  if (errCategory === 'UNSUPPORTED') {
    CDATA = `The following path is invalid: ${value}.`
    errorCode = 'UNSUPPORTED'
    singleError(errorObj, CDATA, errorCode)
  }

  if (errCategory === 'INVALID_REQUEST') {
    CDATA = 'You cannot specify both the at and frequency arguments to a current request.'
    errorCode = 'INVALID_REQUEST'
    singleError(errorObj, CDATA, errorCode)
  }

  if (errCategory === 'ASSET_NOT_FOUND') {
    CDATA = `Could not find asset: ${value}`
    errorCode = 'ASSET_NOT_FOUND'
    singleError(errorObj, CDATA, errorCode)
  }

  if (errCategory === 'MULTIPART_STREAM') {
    const sequenceObj = dataStorage.getSequence()
    const firstSeq = Number(sequenceObj.firstSequence)
    const lastSeq = Number(sequenceObj.lastSequence)
    if (value < firstSeq) {
      CDATA = 'Client can\'t keep up with event stream, disconnecting'
    } else { // firstSeq < lastSeq < value
      CDATA = `from value must be less than or equal to ${lastSeq}, disconnecting.`
    }
    errorCode = 'OUT_OF_RANGE'
    singleError(errorObj, CDATA, errorCode)
  }

  if (errCategory === 'UNSUPPORTED_PUT') {
    CDATA = value
    errorCode = 'UNSUPPORTED'
    singleError(errorObj, CDATA, errorCode)
  }

  if (errCategory === 'QUERY_ERROR') {
    CDATA = `${value} cannot be empty`
    errorCode = 'QUERY_ERROR'
    singleError(errorObj, CDATA, errorCode)
  }
  return errorJSON
}

// To handle multiple error
function categoriseError (errorObj, errCategory, value) {
  let errObj
  if (errCategory === 'SEQUENCEID') {
    errObj = sequenceIdError(value, errorObj)
  }

  if (errCategory === 'INVALID_XPATH') {
    errObj = invalidPathError(value, errorObj)
  }

  if (errCategory === 'FROM') {
    errObj = fromError(value, errorObj)
  }

  if (errCategory === 'COUNT') {
    errObj = countError(value, errorObj)
  }

  if (errCategory === 'INTERVAL') {
    errObj = freqError(value, errorObj)
  }

  return errObj
}

/* ********************** MTConnectAsset Response *************************** */
function createAssetResponse (instanceId, assetItem) {
  const version = 1.3
  const assetBufferSize = dataStorage.assetBuffer.size //'1024' // TODO get from cfg
  // const assetCollection = lokijs.getAssetCollection()
  const assetCount = dataStorage.assetBuffer.length
  //const assetCount = assetCollection.length
  const newTime = moment.utc().format()

  const newXMLns = { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    xmlns: `urn:mtconnect.org:MTConnectAssets:${version}`,
    'xmlns:m': `urn:mtconnect.org:MTConnectAssets:${version}`,
    'xsi:schemaLocation': `urn:mtconnect.org:MTConnectAssets:${version} http://schemas.mtconnect.org/schemas/MTConnectAssets_${version}.xsd` }
  let assetJSON = {}
  assetJSON = { MTConnectAssets:
  { $: newXMLns,
    Header:
    [{ $:
    { creationTime: newTime,
      sender: 'localhost',
      instanceId,
      version,
      assetBufferSize,
      assetCount
    } }],
    Assets: []
  }
  }
  const assetObj = assetJSON.MTConnectAssets.Assets
  if (assetItem !== undefined) {
    assetObj.push(assetItem)
  }
  return assetJSON
}
/* ************************ JSON to XML Conversion *********************** */

/**
  * jsonToXML() converts the JSON object to XML
  *
  * @param {String} source- stringified JSON object
  * @param {obj} res- response to browser
  *
  * write xml object as response in browser
  */
 // TODO !!! remove response write from here

function jsonToXML (data, ctx) {
  const source = new stream.Readable()
  source._read = function noop () {} // redundant? see update below
  source.push(data)
  source.push(null)

  const convert = converter({ 
    from: 'json',
    to: 'xml'
  })

  let buffer = ''
  
  ctx.status = 200
  ctx.set({
    'Content-Type': 'application/xml',
    'Trailer': 'Content-MD5' 
  })

  const cleaner = through(function write (chunk) {
    let result = chunk.toString().replace(/<[/][0-9]+>[\n]|<[0-9]+>[\n]/g, '\r')
    result = result.replace(/^\s*$[\n\r]{1,}/gm, '') // remove blank lines
    buffer += result
    this.queue(result)
  })

  ctx.body = source.pipe(convert).pipe(cleaner)
  ctx.set({
    'Content-MD5': `${md5(buffer)}`
  })
}

function processStreamXML(boundary){
  return through(function send(chunk){
    const string = chunk.toString()
    let resStr = string.replace(/<[/][0-9]+>[\n]|<[0-9]+>[\n]/g, '\r')
    resStr = resStr.replace(/^\s*$[\n\r]{1,}/gm, '')
    let result = `\r\n--${boundary}\r\n` + 'Content-type: application/xml\r\n' + 
      `Content-length: ${resStr.length}\r\n\r\n` + `${resStr}\r\n`

    this.queue(result)
  })
}

function jsonToXMLStream(){
  return through(function send(chunk){
    const string = chunk.toString()
    const xml = builder.buildObject(JSON.parse(string))
    this.queue(xml)
  })
}

/* *****************************JSON CONCATENATION *************************/
function concatenateDeviceStreams (jsonArr) {
  const newJSON = jsonArr[jsonArr.length - 1]
  if (jsonArr.length > 1) {
    const deviceObj = newJSON.MTConnectStreams.Streams[0].DeviceStream
    const componentStreams = deviceObj[0].ComponentStreams
    
    if(componentStreams.length === 0){
      deviceObj.pop()
    } 
    
    for (let i = 0; i < jsonArr.length - 1; i++) {
      const deviceStream = jsonArr[i].MTConnectStreams.Streams[0].DeviceStream[0]
      if(deviceStream.ComponentStreams.length > 0){
        deviceObj.push(jsonArr[i].MTConnectStreams.Streams[0].DeviceStream[0])
      }
    }
    return newJSON
  }
  return newJSON
}

function concatenateAssetswithIds (assetData) {
  const newJSON = assetData[0]
  if (assetData.length > 1) {
    const deviceObj = newJSON.MTConnectAssets.Assets[0]
    for (let i = 1; i < assetData.length; i++) {
      deviceObj.CuttingTool.push(assetData[i].MTConnectAssets.Assets[0].CuttingTool[0])
    }
    return newJSON
  }
  return newJSON
}

function concatenateDevices (jsonArr) {
  const newJSON = jsonArr[jsonArr.length - 1]
  if (jsonArr.length > 1) {
    const deviceObj = newJSON.MTConnectDevices.Devices[0].Device
    for (let i = 0; i < jsonArr.length - 1; i++) {
      deviceObj.push(jsonArr[i].MTConnectDevices.Devices[0].Device[0])
    }
    return newJSON
  }
  return newJSON
}
// Exports

module.exports = {
  updateJSON,
  jsonToXML,
  jsonToXMLStream,
  processStreamXML,
  calculateSequence,
  categoriseError,
  concatenateDevices,
  concatenateDeviceStreams,
  concatenateAssetswithIds,
  createAssetResponse,
  createErrorResponse,
  findDataItemForSample
}
