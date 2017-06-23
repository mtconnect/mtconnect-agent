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

const R = require('ramda')
const CBuffer = require('CBuffer')
const HashMap = require('hashmap')

// Imports - Internal

const log = require('./config/logger')
const config = require('./config/config')

// Constants
const checkPointIndex = config.app.agent.checkPointIndex
const bufferSize = Number(config.app.agent.bufferSize)

// Instances

const hashLast = new HashMap()
const hashCurrent = new HashMap()
const hashAssetCurrent = new HashMap()
const assetBuffer = createCircularBuffer(bufferSize)

// variables
let nextSequence = 0

// Functions
/* ******************** creating circularBuffer *************************** */
function createCircularBuffer (size) {
  const cBuffer = new CBuffer(size)
  return cBuffer
}

const circularBuffer = createCircularBuffer(bufferSize)

function getBufferSize () {
  return bufferSize
}
/* ************************** Supporting functions ************************* */
/**
  * requestPath: '//Device[@name="VMC-3Axis"]//Axes//Rotary'
  * editedPath (replaces [,],and with ''): '//Device@name="VMC-3Axis"//Axes//Rotary'
  * editedPath (splits at // and @): [ '', 'Device', 'name="VMC-3Axis"', 'Axes', 'Rotary' ]
  * editedPath (removes '') [ 'Device', 'name="VMC-3Axis"', 'Axes', 'Rotary' ]
  */

function pathIncludesRequestPath (path, requestPath) {
  let editedPath = requestPath.replace(/\[|\]|and|\s/g, '') // replaces [,], and.
  editedPath = editedPath.split(/\/\/|@/)
  editedPath = editedPath.filter(Boolean) // To remove empty string in array
  let pathStr = path.replace(/\[|\]|and|\s/g, '')
  pathStr = pathStr.split(/\/\/|@/)
  pathStr = pathStr.filter(Boolean)
  const pathCheck = []
  R.map((k) => {
    const temp = R.contains(k, pathStr)
    pathCheck.push(temp)
    return pathCheck // to make eslint happy
  }, editedPath)
  return R.all((k) => R.equals(k, true))(pathCheck)
}

function filterPath (arr, requestPath) {
  return R.filter((v) => pathIncludesRequestPath(v.path, requestPath))(arr)
}

function filterPathArr (arr, requestPath) {
  return R.filter((v) => pathIncludesRequestPath(v, requestPath))(arr)
}
/**
  * Check the given array of dataitems for matching uuid, id.
  *
  * @param arr {array}
  * @param uuidVal {String}
  * @param idVal {String}
  * returns an array of filtered result corresponding to the id.
  *
  */
function filterChainForSample (arr, uuidVal, idVal, path) {
  let result
  const filter = R.pipe(R.values,
                        R.filter((v) => v.uuid === uuidVal),
                        R.filter((v) => v.id === idVal))
  result = filter(arr)
  if (path) {
    result = filterPath(result, path)
  }
  return result
}

/**
  * Check the array of dataitems for matching uuid, id and
  * sequenceId lessthan given seqId
  * @param arr {array}
  * @param uuidVal {String}
  * @param idVal {String}
  * @param seqId {Number} (at = seqId)
  *
  * returns an array of filtered result
  *
  */

function filterChain (arr, uuidVal, idVal, seqId, path) {
  let result
  const filter = R.pipe(R.values,
                        R.filter((v) => v.uuid === uuidVal),
                        R.filter((v) => v.id === idVal),
                        R.filter((v) => v.sequenceId <= seqId))
  result = filter(arr)
  if (path) {
    result = filterPath(result, path)
  }
  return result
}

/**
  * gets called when the circularBuffer is upto overflow
  * inserts the evicted data to hashLast
  * data - the data which will get evicted
  *
  */
circularBuffer.overflow = (data) => {
  const { id } = data
  hashLast.set(id, data)
}

/**
  * calculateCheckPoint gets the checkPoint
  * (at what sequenceId does the first dataItem for the devices exist in CB else -1)
  * @param {Object} obj
  *
  * return checkPoint
  */
function calculateCheckPoint (obj) {
  const k = circularBuffer.toArray()
  const objId = obj.id
  const sequenceId = obj.sequenceId
  let checkPoint
  if (k.length === 0) {
    checkPoint = -1
  } else if ((sequenceId % checkPointIndex === 0)) {
    const keys = hashCurrent.keys()
    const arr = []
    let j = 0
    R.map((c) => {
      if (c !== objId) {
        const index = (R.findLastIndex(R.propEq('id', c))(k))
        // if id not present in circular buffer
        if (index === -1) {
          arr[j++] = -1
        } else {
          arr[j++] = k[index].sequenceId
        }
      }
      return 0 // to make eslint happy
    }, keys)
    // smallest sequence id
    checkPoint = R.sort((a, b) => a - b)(arr)[0]
  } else {
    checkPoint = null
  }
  return checkPoint
}

/**
  * updating the circular buffer after every insertion into DB
  *
  * @param obj = jsonData inserted in lokijs
  * { sequenceId: 0, id:'dtop_2', uuid:'000', time: '2',
  *    dataItemName:'avail', value: 'AVAILABLE' }
  *
  */

function updateCircularBuffer (obj) {
  const checkPoint = calculateCheckPoint(obj)
  circularBuffer.push({ dataItemName: obj.dataItemName,
    uuid: obj.uuid,
    id: obj.id,
    value: obj.value,
    sequenceId: obj.sequenceId,
    time: obj.time,
    path: obj.path,
    sampleCount: obj.sampleCount,
    sampleRate: obj.sampleRate,
    checkPoint
  })
  // const k = circularBuffer.toArray();
  // firstSequence = k[0].sequenceId;
  // lastSequence = k[circularBuffer.length - 1].sequenceId;
}

/**
  * getSequence gives the firstSequence and lastSequence in circular buffer
  * @param = nil
  * return obj = { firstSequence , lastSequence, nextSequence };
  */
function getSequence () {
  const k = circularBuffer.toArray()
  let firstSequence
  let lastSequence
  if (!R.isEmpty(k)) {
    firstSequence = k[0].sequenceId
    lastSequence = k[circularBuffer.length - 1].sequenceId
  } else {
    log.error('circularBuffer is empty')
  }
  const obj = {
    firstSequence,
    lastSequence,
    nextSequence
  }
  return obj
}

/**
  * readFromHashLast() gets the latest
  * value of the dataitem from circular buffer
  *
  * @param {Object} ptr -  pointer to circular buffer
  * @param {String} idVal
  *
  * return the latest entry for that dataitem
  *
  */
function readFromHashLast (idVal, path) {
  let result = hashLast.get(idVal)
  if (path) {
    result = filterPath([result], path)
    if (!R.isEmpty(result)) {
      return result[0]
    }
    return undefined
  }
  return result
}

/**
  * readFromHashCurrent() gets the latest
  * value of the dataitem from circular buffer
  *
  * @param {Object} ptr -  pointer to circular buffer
  * @param {String} idVal
  * @param {String} uuidVal
  * @param {String} nameVal
  *
  * return the latest entry for that dataitem
  *
  */
function readFromHashCurrent (idVal, path) {
  let result = hashCurrent.get(idVal)
  if (path) {
    result = filterPath([result], path)
    if (!R.isEmpty(result)) {
      return result[0]
    }
    return undefined
  }
  return result
}

/**
  * getRecentDataItemForSample gives the array of dataitems
  * in the specified range of sequenceIds
  *
  * @param {Number} from- sequenceId which is the lowerBound
  * @param {Number} count - from + count is the upperBound sequenceId
  * @param {String} uuidVal - uuid of devices
  * @param {String} idVal - dataItemId
  *
  * return latestEntry - array of dataitems within the bound from CB
  * returns  string 'ERROR' if from is outside the range of sequenceId.
  */

function getRecentDataItemForSample (from, idVal, uuidVal, count, path) {
  let lowerBound
  let upperBound
  let endPoint
  let cbArr = circularBuffer.toArray()
  const firstSequence = getSequence().firstSequence
  const lastSequence = getSequence().lastSequence
  const sequenceId = Number(from)

  // if from value within the range
  if ((firstSequence <= sequenceId) && (sequenceId <= lastSequence)) {
    endPoint = sequenceId + count
    lowerBound = (R.findIndex(R.propEq('sequenceId', sequenceId))(cbArr))

    // if from + count within the range
    if ((firstSequence <= endPoint) && (endPoint <= lastSequence)) {
      upperBound = (R.findIndex(R.propEq('sequenceId', endPoint))(cbArr))
    } else { // if from + count > lastSequence
      upperBound = Infinity
    }

    cbArr = cbArr.slice(lowerBound, upperBound)
    nextSequence = cbArr[cbArr.length - 1].sequenceId + 1
    const latestEntry = filterChainForSample(cbArr, uuidVal, idVal, path)
    return latestEntry
  }
  log.debug('from out side the range of sequenceId')
  return 'ERROR'
}

/**
  * readFromCircularBuffer() gets the latest
  * value of the dataitem from circular buffer
  *
  * @param {String} idVal
  * @param {String} uuidVal
  * @param {String} nameVal
  *
  * return the latest entry for that dataitem
  *
  */
function readFromCircularBuffer (seqId, idVal, uuidVal, path) {
  let lowerBound
  let upperBound
  const sequenceId = Number(seqId)
  const firstSequence = getSequence().firstSequence
  const lastSequence = getSequence().lastSequence
  if ((firstSequence <= sequenceId) && (sequenceId <= lastSequence)) {
    let cbArr = circularBuffer.toArray()
    const index = (R.findIndex(R.propEq('sequenceId', sequenceId))(cbArr))
    const checkPoint = cbArr[index].checkPoint
    if ((checkPoint === -1) || (checkPoint === null)) {
      lowerBound = 0
    } else {
      lowerBound = (R.findIndex(R.propEq('sequenceId', checkPoint))(cbArr))
    }
    upperBound = index
    cbArr = cbArr.slice(lowerBound, upperBound + 1)
    const latestEntry = filterChain(cbArr, uuidVal, idVal, sequenceId, path)
    let result = latestEntry[latestEntry.length - 1]
    if (result === undefined) {
      result = readFromHashLast(idVal, path)
    }
    return result
  }
  log.debug('ERROR: sequenceId out of range')
  return 'ERROR'
}

/**
  * pascalCase() converts the string to pascal case
  * @param {String} str
  * return res
  *
  * Eg. str = hello_World  res= Hello_World
  * Eg. str = helloworld   res= Helloworld
  */
function pascalCase (strReceived) {
  if (strReceived !== undefined) {
    return strReceived.replace(/\w\S*/g,
      (txt) => {
        const str = txt.split('_')
        let res = ''
        if (str) {
          let str0 = ''
          let str1 = ''
          str0 = str[0].charAt(0).toUpperCase() + str[0].substr(1).toLowerCase()
          if (str[1]) {
            str1 = str[1].charAt(0).toUpperCase() + str[1].substr(1).toLowerCase()
          }
          res = str0 + str1
        }
        return res
      })
  }
  return log.error('Internal Error')
}

function handleCondition (objVal, value) {
  const obj = objVal
  if (value[1] !== '') {
    obj.$.nativeCode = value[1]
  }
  if (value[2] !== '') {
    obj.$.nativeSeverity = value[2]
  }
  if (value[3] !== '') {
    obj.$.qualifier = value[3]
  }
  if (value[4] !== '') {
    obj._ = value[4]
  }
  return obj
}

function handleAlarm (objVal, value) {
  const obj = objVal
  if (value[0] !== '') {
    obj.$.code = value[0]
  }
  if (value[1] !== '') {
    obj.$.nativeCode = value[1]
  }
  if (value[2] !== '') {
    obj.$.severity = value[2]
  }
  if (value[3] !== '') {
    obj.$.state = value[3]
  }
  if (value[4] !== '') {
    obj._ = value[4]
  }
  return obj
}

function handleMessage (objVal, value) {
  const obj = objVal
  if (value[0] !== '') {
    obj.$.nativeCode = value[0]
  }
  obj._ = value[1]
}
/**
  * createDataItemForEachId creates the dataItem with recent value
  * and append name and subType if present and associate it to Object type
  * for all dataItem(s) for the given id
  *
  * @param {Array} recentDataEntry - array of dataItem(s) for an id in the sequence range.
  * @param {Object} data - sequenceId specified in the request
  * @param {String} category - specifies the category as EVENT, SAMPLE or CONDITION.
  *
  * return dataItem - array of dataItem(s) for an id.
  */

function createDataItemForEachId (recentDataEntry, data, category) {
  const dataItem = []

  let type = pascalCase(data.type)
  for (let i = 0; i < recentDataEntry.length; i++) {
    const value = recentDataEntry[i].value
    const obj = { $: { dataItemId: data.id,
      timestamp: recentDataEntry[i].time,
      sequence: recentDataEntry[i].sequenceId
    }
    }
    if (data.name) {
      obj.$.name = data.name
    }
    if (data.subType) {
      obj.$.subType = data.subType
    }

    if (data.representation === 'TIME_SERIES') {
      type = `${type}TimeSeries`
      obj.$.sampleCount = recentDataEntry[i].sampleCount
      obj.$.sampleRate = recentDataEntry[i].sampleRate
    }

    if (category === 'CONDITION') {
      obj.$.type = data.type // TODO if (obj.$.type !== undefined)

      if (Array.isArray(value)) {
        dataItem[i] = R.assoc(pascalCase(value[0]), obj, {})
        handleCondition(obj, value)
      } else {
        dataItem[i] = R.assoc(pascalCase(value), obj, {})
      }
    } else {
      if (data.type === 'MESSAGE') {
        if (Array.isArray(value)) {
          handleMessage(obj, value)
        }
      } else if (data.type === 'ALARM') {
        if (Array.isArray(value)) {
          handleAlarm(obj, value)
        } else {
          obj._ = value
        }
      } else {
        obj._ = value
      }
      dataItem[i] = R.assoc(type, obj, {})
    }
  }
  return dataItem
}

/**
  * createSampleDataItem creates dataItem array for the entire categoryArr
  * @param {Array} categoryArr - array of dataItem(s) of one category.
  * @param {String} sequenceId - 'from' value from request
  * @param {String} category - category of the dataItem (EVENT, SAMPLE, CONDITION)
  * @param {String} uuidVal - device uuid
  * @param {String} countVal - 'count' from request
  *
  * return dataItem - array of dataItem(s) for the particular category in the sequenceId bound.
  */
function createSampleDataItem (categoryArr, sequenceId, category, uuidVal, countVal, path) {
  const recentDataEntry = []
  const dataItem = []
  const seqId = Number(sequenceId)
  const count = Number(countVal)
  for (let i = 0, j = 0; i < categoryArr.length; i++) {
    const data = categoryArr[i].$
    recentDataEntry[i] = getRecentDataItemForSample(seqId, data.id, uuidVal, count, path)
    if (!(R.isEmpty(recentDataEntry[i])) && (recentDataEntry[i] !== 'ERROR')) {
      dataItem[j++] = createDataItemForEachId(recentDataEntry[i], data, category)
    } else if (recentDataEntry[i] === 'ERROR') {
      return log.debug('OUT_OF_RANGE Error')
    }
  }
  return dataItem
}

/**
  * createDataItem creates the dataItem with recent value
  * and append name and subType if present and associate it to Object type
  *
  * @param {Object} categoryArr - Array of EVENT or SAMPLE or CONDITION
  * @param {String} sequenceId - sequenceId specified in the request
  * @param {String} category - specifies the category as EVENT, SAMPLE or CONDITION.
  * @param {String} uuid - device uuid
  *
  * return dataItem
  */

function createDataItem (categoryArr, sequenceId, category, uuid, path) {
  const recentDataEntry = []
  const dataItem = []
  for (let i = 0; i < categoryArr.length; i++) {
    const data = categoryArr[i].$
    let type = pascalCase(data.type)
    if ((sequenceId === undefined) || (sequenceId === '')) { // current
      recentDataEntry[i] = readFromHashCurrent(data.id, path)
    } else { // current?at
      recentDataEntry[i] = readFromCircularBuffer(sequenceId, data.id, uuid, path)
    }
    if (recentDataEntry[i] !== undefined) {
      const value = recentDataEntry[i].value
      const obj = { $: { dataItemId: data.id,
        timestamp: recentDataEntry[i].time,
        sequence: recentDataEntry[i].sequenceId
      }
      }
      if (data.name) {
        obj.$.name = data.name
      }

      if(recentDataEntry[i].assetType){
        obj.$.assetType = recentDataEntry[i].assetType
      }

      if (data.subType) {
        obj.$.subType = data.subType
      }
      if (data.representation === 'TIME_SERIES') {
        type = `${type}TimeSeries`
        obj.$.sampleCount = recentDataEntry[i].sampleCount
        obj.$.sampleRate = recentDataEntry[i].sampleRate
      }
      if (category === 'CONDITION') {
        obj.$.type = data.type
        if (Array.isArray(value)) {
          dataItem[i] = R.assoc(pascalCase(value[0]), obj, {})
          handleCondition(obj, value)
        } else {
          dataItem[i] = R.assoc(pascalCase(value), obj, {})
        }
      } else {
        if (data.type === 'MESSAGE') {
          if (Array.isArray(value)) {
            handleMessage(obj, value)
          } else {
            obj._ = recentDataEntry[i].value
          }
        } else if (data.type === 'ALARM') {
          if (Array.isArray(value)) {
            handleAlarm(obj, value)
          } else {
            obj._ = recentDataEntry[i].value
          }
        } else {
          obj._ = recentDataEntry[i].value
        }
        dataItem[i] = R.assoc(type, obj, {})
      }
    }
  }
  return dataItem
}

/**
  * categoriseDataItem() categorise dataItem into EVENT, SAMPLE, CONDITION
  *
  * @param {Object} latestSchema - latest deviceSchema for uuid
  * @param {Object} circularBufferPtr
  *
  * return DataItemVar with latest value appended to it.
  * It has three objects Event, Sample, Condition.
  */
function categoriseDataItem (latestSchema, dataItemsArr, sequenceId, uuid, path, count) {
  const DataItemVar = {}
  const eventArr = []
  const sample = []
  const condition = []
  let eventObj
  let sampleObj
  let conditionObj

  for (let i = 0, j = 0, k = 0, l = 0; i < dataItemsArr.length; i++) {
    const category = dataItemsArr[i].$.category
    if (category === 'EVENT') {
      eventArr[j++] = dataItemsArr[i]
    } else if (category === 'SAMPLE') {
      sample[k++] = dataItemsArr[i]
    } else { // if (category === 'CONDITION')
      condition[l++] = dataItemsArr[i]
    }
  }

  if (count) {
    eventObj = createSampleDataItem(eventArr, sequenceId, 'EVENT', uuid, count, path)
    sampleObj = createSampleDataItem(sample, sequenceId, 'SAMPLE', uuid, count, path)
    conditionObj = createSampleDataItem(condition, sequenceId, 'CONDITION', uuid, count, path)
  } else {
    eventObj = createDataItem(eventArr, sequenceId, 'EVENT', uuid, path)
    sampleObj = createDataItem(sample, sequenceId, 'SAMPLE', uuid, path)
    conditionObj = createDataItem(condition, sequenceId, 'CONDITION', uuid, path)
  }

  DataItemVar.Event = eventObj
  DataItemVar.Sample = sampleObj
  DataItemVar.Condition = conditionObj
  return DataItemVar
}

/* ******************************  ASSET reading ****************************** */
function sortByTime (arr) {
  const sortTime = R.sortBy(R.prop('time'))
  const result = sortTime(arr)
  return R.reverse(result)
}

function filterByCount (count, assetSet) {
  let assetCount = 0
  let j = 0; let m = 0
  const result = []
  const assetId = []
  const assetList = assetSet
  if (!R.isEmpty(assetList)) {
    result[j++] = assetList[0]
    assetCount++
    assetId[m++] = result[j - 1].assetId
    for (let i = 1; (assetCount < count && i < assetList.length); i--) {
      let idPresent = false
      for (let k = 0; k < assetId.length; k++) {
        if (assetList[i].assetId === assetId[k]) {
          idPresent = true
        }
      }
      if (!idPresent) {
        result[j++] = assetList[i]
        assetId[m++] = result[j - 1].assetId
        assetCount++
      }
    }
  }
  return result
}

function filterAssets (assetData, type, count, removed, target, archetypeId) {
  let assetSet = assetData
  if (type) {
    assetSet = R.filter((v) => v.assetType === type)(assetSet)
  }
  if (removed) { // include removed assets also
    assetSet = R.filter((v) => (v.removed === true || v.removed === false))(assetSet)
  } else {
    assetSet = R.filter((v) => v.removed === false)(assetSet)
  }
  if (target) {
    assetSet = R.filter((v) => v.target === target)(assetSet)
  }
  assetSet = sortByTime(assetSet)
  if (count) {
    assetSet = filterByCount(count, assetSet)
  }
  return assetSet
}

function createAssetItemForAssets (assetDetails) {
  const cuttingTool = []
  const obj = {}
  let i = 0
  if (!R.isEmpty(assetDetails)) {
    R.map((k) => {
      if (k !== undefined) {
        const valueJSON = k.value
        if (k.assetType === 'CuttingTool') {
          delete valueJSON.CuttingTool.Description // remove Description
          if(typeof(valueJSON.CuttingTool) === 'object'){
            cuttingTool[i++] = valueJSON.CuttingTool
            cuttingTool[i - 1].$.assetId = k.assetId
            cuttingTool[i - 1].$.timestamp = k.time
            cuttingTool[i - 1].$.deviceUuid = k.uuid
          } else {
            cuttingTool[i++] = {
              _: valueJSON.CuttingTool, 
              $: {}
            }
            if(k.removed){
              cuttingTool[i - 1].$.removed = k.removed
            }
          } 
        }
      }
      return cuttingTool // to make eslint happy
    }, assetDetails)
  }
  obj.CuttingTool = cuttingTool
  return obj
}

function createAssetItem (assetDetails) {
  const obj = { CuttingTool: [] }
  if (assetDetails !== undefined) {
    const valueJSON = assetDetails.value
    delete valueJSON.CuttingTool.Description // remove Description
    obj.CuttingTool[0] = valueJSON.CuttingTool
    if(typeof(obj.CuttingTool[0]) === 'object'){
      if(!obj.CuttingTool[0].$){
        obj.CuttingTool[0].$ = {}
      }
      obj.CuttingTool[0].$.assetId = assetDetails.assetId
      obj.CuttingTool[0].$.timestamp = assetDetails.time
      obj.CuttingTool[0].$.deviceUuid = assetDetails.uuid
    }
  }
  return obj
}

function readAssets (assetCollection, type, count, removed, target, archetypeId) {
  const assetData = []
  let assetDetails
  let i = 0
  R.map((k) => {
    const obj = hashAssetCurrent.get(k)
    if (obj !== undefined) {
      assetData[i++] = obj
    }
    return assetData // eslint
  }, assetCollection)
  
  assetDetails = filterAssets(assetData, type, count, removed, target, archetypeId)
  //assetDetails = sortByTime(assetData)
  const assetResult = createAssetItemForAssets(assetDetails)

  return assetResult
}

function readAssetforId (assetId, type, count, removed, target, archetypeId) {
  const assetDetails = hashAssetCurrent.get(assetId)
  const assetResult = createAssetItem(assetDetails)
  return assetResult
}
// Exports

module.exports = {
  categoriseDataItem,
  updateCircularBuffer,
  circularBuffer,
  assetBuffer,
  createDataItemForEachId,
  hashCurrent,
  hashLast,
  hashAssetCurrent,
  getSequence,
  getBufferSize,
  readFromHashCurrent,
  readFromHashLast,
  readFromCircularBuffer,
  bufferSize,
  pascalCase,
  readAssetforId,
  readAssets,
  getRecentDataItemForSample,
  filterPath,
  filterPathArr,
  filterAssets
}
