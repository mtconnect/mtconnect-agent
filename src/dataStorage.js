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
const R = require('ramda');
const CBuffer = require('CBuffer');
const HashMap = require('hashmap');

// Imports - Internal

const log = require('./config/logger');
const config = require('./config/config');

// Constants
const checkPointIndex = config.app.agent.checkPointIndex;
const bufferSize = Number(config.app.agent.bufferSize);

// Instances
const hashLast = new HashMap();
const hashCurrent = new HashMap();
const hashAssetCurrent = new HashMap();
const hashCondition = new HashMap();
const hashAdapters = new HashMap();
const hashDataItemsByName = new HashMap();
const hashDataItemsBySource = new HashMap();

// variables
let nextSequence = 0;

// Functions
/* ******************** change and set configurations of adapters *************************** */
function setConfiguration(device, parameter, value) {
  if (!(device && device.$.name && device.$.id)) return undefined;
  
  if (!hashAdapters.has(device.$.name)) {
    console.log(`The requested device name ${device.$.name} is not present in list of adapters`);
    return undefined;
  }
  
  const adapter = hashAdapters.get(device.$.name);
  
  adapter[parameter] = value;
  return adapter[parameter];
}

function getConfiguredVal(devName, parName) {
  const adapter = hashAdapters.get(devName);
  if (!adapter) {
    console.log(`The requested device name ${devName} is not present in list of adapters`);
    return undefined;
  }

  if (adapter[parName] === undefined) {
    console.log(`The requested parameter name ${parName} is not present in device ${devName}`);
    return undefined;
  }

  return adapter[parName];
}

/* ******************** creating circularBuffer *************************** */
function createCircularBuffer (size) {
  const cBuffer = new CBuffer(size);
  return cBuffer;
}

const circularBuffer = createCircularBuffer(bufferSize);
const assetBuffer = createCircularBuffer(bufferSize);

function getBufferSize () {
  return bufferSize;
}
/* ************************** Supporting functions ************************* */
/**
  * requestPath: '//Device[@name="VMC-3Axis"]//Axes//Rotary'
  * editedPath (replaces [,],and with ''): '//Device@name="VMC-3Axis"//Axes//Rotary'
  * editedPath (splits at // and @): [ '', 'Device', 'name="VMC-3Axis"', 'Axes', 'Rotary' ]
  * editedPath (removes '') [ 'Device', 'name="VMC-3Axis"', 'Axes', 'Rotary' ]
  */

function pathIncludesRequestPath (path, requestPath) {
  let editedPath = requestPath.replace(/\[|\]|and|\s/g, ''); // replaces [,], and.
  editedPath = editedPath.split(/\/\/|@/);
  editedPath = editedPath.filter(Boolean); // To remove empty string in array
  let pathStr = path.replace(/\[|\]|and|\s/g, '');
  pathStr = pathStr.split(/\/\/|@/);
  pathStr = pathStr.filter(Boolean);
  const pathCheck = [];
  R.map((k) => {
    const temp = R.contains(k, pathStr);
    pathCheck.push(temp);
    return pathCheck; // to make eslint happy
  }, editedPath);
  return R.all((k) => R.equals(k, true))(pathCheck);
}

function filterPath (arr, requestPath) {
  return R.filter((v) => pathIncludesRequestPath(v.path, requestPath))(arr)
}

function filterPathArr (arr, requestPath) {
  return R.filter((v) => pathIncludesRequestPath(v, requestPath))(arr)
}

function findIndexClosestToAnd(path) {
  let index = path.indexOf('[');
  let prev = 0;
  while (index !== -1) {
    prev += index;
    index = path.substr(index + 1, path.length).indexOf('[');
    if (index !== -1) {
      prev += 1 // because we move path to index + 1
    }
  }
  return prev
}

function dividingPath(path){
  const paths = [];
  const indexOfAnd = path.indexOf('and');
  const half1 = path.substr(0, indexOfAnd - 1);
  const half2 = path.substr(indexOfAnd + 4, path.length);
  const indexOfOpen = findIndexClosestToAnd(half1);
  const indexOfClose = half2.indexOf(']');
  
  paths.push(half1.substr(0, indexOfOpen + 1) + half2);
  paths.push(half1 + half2.substr(indexOfClose, half2.length));
  return paths;
}

function dividingPaths(requestPath) {
  if (requestPath.includes('and')) {
    const result = [];
    const paths = dividingPath(requestPath);
    R.map(path => {
        let arr;
        if(path.includes('and')){
          arr = dividingPaths(path)
        }
        if(arr){
          R.map((item) => {
            result.push(item)
          }, arr)
        } else {
          result.push(path)
        }
      }, paths);
    return result;
  }
  
  return requestPath
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
  let result;
  const filter = R.pipe(R.values,
                        R.filter((v) => v.uuid === uuidVal),
                        R.filter((v) => v.id === idVal));
  result = filter(arr);
  if (path) {
    paths = dividingPaths(path);
    
    if(Array.isArray(paths)){
      const arr = getDataItemsForMultiplePaths(paths, result);
      return arr
    } else {
      result = filterPath(result, path);
      return result
    }
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
  let result;
  const filter = R.pipe(R.values,
                        R.filter((v) => v.uuid === uuidVal),
                        R.filter((v) => v.id === idVal),
                        R.filter((v) => v.sequenceId <= seqId));
  result = filter(arr);
  if (path) {
    paths = dividingPaths(path);
    
    if(Array.isArray(paths)){
      const arr = getDataItemsForMultiplePaths(paths, result);
      return arr
    } else {
      result = filterPath(result, path);
      return result
    }
    //result = filterPath(result, path)
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
  const { id } = data;
  hashLast.set(id, data)
};

assetBuffer.overflow = (data) => {
  const { id } = data;
  hashAssetCurrent.remove(id)
};

/**
  * calculateCheckPoint gets the checkPoint
  * (at what sequenceId does the first dataItem for the devices exist in CB else -1)
  * @param {Object} obj
  *
  * return checkPoint
  */
function calculateCheckPoint (obj) {
  const k = circularBuffer.toArray();
  const objId = obj.id;
  const sequenceId = obj.sequenceId;
  let checkPoint;
  if (k.length === 0) {
    checkPoint = -1
  } else if ((sequenceId % checkPointIndex === 0)) {
    const keys = hashCurrent.keys();
    const arr = [];
    let j = 0;
    R.map((c) => {
      if (c !== objId) {
        const index = (R.findLastIndex(R.propEq('id', c))(k));
        // if id not present in circular buffer
        if (index === -1) {
          arr[j++] = -1
        } else {
          arr[j++] = k[index].sequenceId
        }
      }
      return 0 // to make eslint happy
    }, keys);
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
  const checkPoint = calculateCheckPoint(obj);
  circularBuffer.push({ dataItemName: obj.dataItemName,
    uuid: obj.uuid,
    id: obj.id,
    value: obj.value,
    sequenceId: obj.sequenceId,
    time: obj.time,
    path: obj.path,
    sampleCount: obj.sampleCount,
    sampleRate: obj.sampleRate,
    statistic: obj.statistic,
    duration: obj.duration,
    resetTriggered: obj.resetTriggered,
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
  const k = circularBuffer.toArray();
  let firstSequence;
  let lastSequence;
  if (!R.isEmpty(k)) {
    firstSequence = k[0].sequenceId;
    lastSequence = k[circularBuffer.length - 1].sequenceId
  } else {
    log.error('circularBuffer is empty')
  }
  const obj = {
    firstSequence,
    lastSequence,
    nextSequence
  };
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
  let result = hashLast.get(idVal);
  if (path) {
    result = filterPath([result], path);
    if (!R.isEmpty(result)) {
      return result[0]
    }
    return undefined
  }
  return result
}

function getDataItemsForMultiplePaths(paths, dataitem){
  let arr = [];
  let res;
  
  R.map((p) => {
    res = filterPath(dataitem, p);
    if(!R.isEmpty(res)){
      R.map((item) => {
        arr.push(item)
      }, res)
    }
  }, paths);
  return arr
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
  let result = hashCurrent.get(idVal);
  //findItemsFromHashCurrent(idVal)
  if (path) {
    paths = dividingPaths(path);
    
    if(Array.isArray(paths)){
      const arr = getDataItemsForMultiplePaths(paths, [result]);
      
      if(!R.isEmpty(arr)){
        return arr[0]
      }
      return undefined
    
    } else {
      result = filterPath([result], path);
      if (!R.isEmpty(result)) {
        return result[0]
      }
      return undefined
    }
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
  let lowerBound;
  let upperBound;
  let endPoint;
  let cbArr = circularBuffer.toArray();
  const firstSequence = getSequence().firstSequence;
  const lastSequence = getSequence().lastSequence;
  const sequenceId = Number(from);

  // if from value within the range
  if ((firstSequence <= sequenceId) && (sequenceId <= lastSequence)) {
    endPoint = sequenceId + count;
    lowerBound = (R.findIndex(R.propEq('sequenceId', sequenceId))(cbArr));

    // if from + count within the range
    if ((firstSequence <= endPoint) && (endPoint <= lastSequence)) {
      upperBound = (R.findIndex(R.propEq('sequenceId', endPoint))(cbArr))
    } else { // if from + count > lastSequence
      upperBound = Infinity
    }

    cbArr = cbArr.slice(lowerBound, upperBound);
    nextSequence = cbArr[cbArr.length - 1].sequenceId + 1;
    const latestEntry = filterChainForSample(cbArr, uuidVal, idVal, path);
    return latestEntry
  }
  log.debug('from out side the range of sequenceId');
  return 'ERROR'
}
/**
  * getRecentEntriesForCondition() checks for warning and faults for
  * particular id
  *
  * @param {array} recent entries for id
  *
  * returns array if warnings and faults are present
  * else return recent entry
  */

function getRecentEntriesForCondition(latestEntry){
  const reversedEntries = latestEntry.slice(0).reverse();
  const issues = [];
  const length = reversedEntries.length;
  let i = 0;
  
  while(reversedEntries[i] &&
    reversedEntries[i].value !== 'UNAVAILABLE' &&
    reversedEntries[i].value[0] !== 'UNAVAILABLE' &&
    reversedEntries[i].value[1] !== ''){
    issues.push(reversedEntries[i]);
    i++
  }

  const codes = {};
  if(issues.length > 0){
    let code;
    R.map((entry) => {
      code = entry.value[1];
      if(code){
        if(!codes[code]){
          codes[code] = []
        }
        codes[code].push(entry)
      }
    }, issues)
  }

  const latest = [];
  if(!R.isEmpty(codes)){
    const keys = R.keys(codes);
    R.map((key) => {
      const value = codes[key][0].value;
      if(value[0] !== 'NORMAL'){
        latest.push(codes[key][0])
      }
    }, keys)
  }

  if(R.isEmpty(latest)){
    return reversedEntries[0]
  } else {
    return latest
  }
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
function readFromCircularBuffer (seqId, idVal, uuidVal, path, category) {
  let lowerBound;
  let upperBound;
  const sequenceId = Number(seqId);
  const firstSequence = getSequence().firstSequence;
  const lastSequence = getSequence().lastSequence;
  if ((firstSequence <= sequenceId) && (sequenceId <= lastSequence)) {
    let cbArr = circularBuffer.toArray();
    const index = (R.findIndex(R.propEq('sequenceId', sequenceId))(cbArr));
    const checkPoint = cbArr[index].checkPoint;
    
    if ((checkPoint === -1) || (checkPoint === null)) {
      lowerBound = 0
    } else {
      lowerBound = (R.findIndex(R.propEq('sequenceId', checkPoint))(cbArr))
    }
    
    upperBound = index;
    cbArr = cbArr.slice(lowerBound, upperBound + 1);
    const latestEntry = filterChain(cbArr, uuidVal, idVal, sequenceId, path);
    let result;
    
    if(category === 'CONDITION'){
      result = getRecentEntriesForCondition(latestEntry)
    } else {
      result = latestEntry[latestEntry.length - 1]
    }
    
    if (result === undefined) {
      result = readFromHashLast(idVal, path)
    }
    
    if((result && result.value) &&
      (result.value[0] === 'NORMAL' && result.value[1] !== '')){
      result = replaceValueOfConditionDataItem(result)
    }
    
    return result
  }

  log.debug('ERROR: sequenceId out of range');
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
      txt => {
        if(R.contains(':', txt)){
          const str = txt.split(':');
          txt = str[1]
        }
        
        const str = txt.split('_');
        let res = '';
        for (let i = 0; i < str.length; i++ ) {
          res += str[i].charAt(0).toUpperCase() + str[i].substr(1).toLowerCase()
        }

        return res;
      })
  }
  return log.error('Internal Error')
}

function handleCondition (objVal, value) {
  const obj = objVal;
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
  const obj = objVal;
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
  const obj = objVal;
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
  const dataItem = [];
  let type = pascalCase(data.type);
  for (let i = 0; i < recentDataEntry.length; i++) {
    const value = recentDataEntry[i].value;
    const obj = { $: { dataItemId: data.id,
      timestamp: recentDataEntry[i].time,
      sequence: recentDataEntry[i].sequenceId
    }
    };
    
    if (data.name) {
      obj.$.name = data.name
    }
    
    if (data.subType) {
      obj.$.subType = data.subType
    }
    
    if(recentDataEntry[i].assetType){
      obj.$.assetType = recentDataEntry[i].assetType
    }

    if(recentDataEntry[i].statistic){
      obj.$.statistic = recentDataEntry[i].statistic;
      if(value != 'UNAVAILABLE'){
        obj.$.duration = recentDataEntry[i].duration
      }
    } else {
      if(recentDataEntry[i].duration){
        obj.$.duration = recentDataEntry[i].duration
      }
    }

    if(recentDataEntry[i].resetTriggered){
      obj.$.resetTriggered = recentDataEntry[i].resetTriggered
    }

    if (data.representation === 'TIME_SERIES') {
      type = `${type}TimeSeries`;
      obj.$.sampleCount = recentDataEntry[i].sampleCount;
      obj.$.sampleRate = recentDataEntry[i].sampleRate
    }

    if (data.representation === 'DISCRETE') {
      if(!type.includes('Discrete')){
        type = `${type}Discrete`
      }
    }

    if (category === 'CONDITION') {
      obj.$.type = data.type; // TODO if (obj.$.type !== undefined)

      if (Array.isArray(value)) {
        dataItem[i] = R.assoc(pascalCase(value[0]), obj, {});
        handleCondition(obj, value)
      } else {
        dataItem[i] = R.assoc(pascalCase(value), obj, {})
      }
    } else {
      if (data.type === 'MESSAGE') {
        if (Array.isArray(value)) {
          handleMessage(obj, value)
        } else {
          obj._ = value
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
  const recentDataEntry = [];
  const dataItem = [];
  const seqId = Number(sequenceId);
  const count = Number(countVal);
  for (let i = 0, j = 0; i < categoryArr.length; i++) {
    const data = categoryArr[i].$;
    recentDataEntry[i] = getRecentDataItemForSample(seqId, data.id, uuidVal, count, path);
    if (!(R.isEmpty(recentDataEntry[i])) && (recentDataEntry[i] !== 'ERROR')) {
      dataItem[j++] = createDataItemForEachId(recentDataEntry[i], data, category)
    } else if (recentDataEntry[i] === 'ERROR') {
      return log.debug('OUT_OF_RANGE Error')
    }
  }

  return dataItem
}

function buildDataItem(recentDataEntry, data, type, category){
  let dataItem;
  if (recentDataEntry !== undefined) {
    const value = recentDataEntry.value;
    const obj = { $: { dataItemId: data.id,
      timestamp: recentDataEntry.time,
      sequence: recentDataEntry.sequenceId
    } };
    
    if (data.name) {
      obj.$.name = data.name
    }
    
    if(recentDataEntry.statistic){
      obj.$.statistic = recentDataEntry.statistic;
      obj.$.duration = recentDataEntry.duration
    } else {
      if(recentDataEntry.duration){
        obj.$.duration = recentDataEntry.duration
      }
    }
    
    if(recentDataEntry.assetType){
      obj.$.assetType = recentDataEntry.assetType
    }

    if (data.subType) {
      obj.$.subType = data.subType
    }
    if (data.representation === 'TIME_SERIES') {
      type = `${type}TimeSeries`;
      obj.$.sampleCount = recentDataEntry.sampleCount;
      obj.$.sampleRate = recentDataEntry.sampleRate
    }

    if(recentDataEntry.resetTriggered){
      obj.$.resetTriggered = recentDataEntry.resetTriggered
    }

    if (data.representation === 'DISCRETE') {
      type = `${type}Discrete`
    }
    
    if (category === 'CONDITION') {
      obj.$.type = data.type;
      if (Array.isArray(value)) {
        dataItem = R.assoc(pascalCase(value[0]), obj, {});
        handleCondition(obj, value)
      } else {
        dataItem = R.assoc(pascalCase(value), obj, {})
      }
    } else {
      if (data.type === 'MESSAGE') {
        if (Array.isArray(value)) {
          handleMessage(obj, value)
        } else {
          obj._ = recentDataEntry.value
        }
      } else if (data.type === 'ALARM') {
        if (Array.isArray(value)) {
          handleAlarm(obj, value)
        } else {
          obj._ = recentDataEntry.value
        }
      } else {
        obj._ = recentDataEntry.value
      }
      dataItem = R.assoc(type, obj, {})
    }
  }
  return dataItem
}

/**
  * replaceValueOfConditionDataItem() make a copy of an item
  * and replaces values array with empty strings starting from index 1
  * @params {object} item
  *
  * returns copy of item with new value
  *
  */

function replaceValueOfConditionDataItem(item){
  const copy = R.clone(item);
  for(let i = 1, len = copy.value.length; i < len; i++){
    copy.value[i] = ''
  }
  return copy
}

//returns array
function gettingItemsForCondition(id, path){
  const map = hashCondition.get(id);
  const items = [];
  let result;
  
  if(map && map.size > 0){
    map.forEach((value, key)=>{
      items.push(value)
    });
    
    if (path) {
      result = filterPath(items, path);
      if (!R.isEmpty(result)) {
        return result
      }
      return []
    }

    return items
  
  } else {
    result = readFromHashCurrent(id, path);

    if(result && result.value[0] === 'NORMAL' && result.value[1] !== ''){
      result = replaceValueOfConditionDataItem(result)
    }

    return [result]
  }
}

function addToHashCondition(obj){
  const id = obj.id;
  const code = obj.value[1];
  const value = obj.value;
  const level = obj.value[0];

  if(level === 'NORMAL' && code !== ''){
    if(hashCondition.has(id)){
      const map = hashCondition.get(id);
      map.delete(code);
      hashCondition.set(id, map)
    }
  }

  if(code !== '' && level !== 'NORMAL'){
    if(hashCondition.has(id)){
      const map = hashCondition.get(id);
      map.set(code, obj);
      hashCondition.set(id, map)
    } else {
      const map = new Map();
      map.set(code, obj);
      hashCondition.set(id, map)
    }
  }

  if((code === '' && level === 'NORMAL')
    || value === 'UNAVAILABLE'
    || level === 'UNAVAILABLE'){
    if(hashCondition.hash(id)){
      hashCondition.remove(id)
    }
  }
}


function createDataItemsForCondition(categoryArr, sequenceId, category, uuid, path){
  let recentDataEntry;
  const dataItem = [];
  let j = 0;
  let data;
  let type;

  for(let i = 0, len = categoryArr.length; i < len; i++){
    data = categoryArr[i].$;
    type = pascalCase(data.type);
    
    if ((sequenceId === undefined) || (sequenceId === '')){
      recentDataEntry = gettingItemsForCondition(data.id, path)
    } else { //current?at
      recentDataEntry = readFromCircularBuffer(sequenceId, data.id, uuid, path, category)
    }

    if(recentDataEntry && !Array.isArray(recentDataEntry)){
      dataItem[j++] = buildDataItem(recentDataEntry, data, type, category)
    }
    
    if(recentDataEntry && Array.isArray(recentDataEntry)){
      R.map((dataEntry) => {
        dataItem[j++] = buildDataItem(dataEntry, data, type, category)
      }, recentDataEntry)
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
  let recentDataEntry;
  const dataItem = [];
  let j = 0;

  for (let i = 0; i < categoryArr.length; i++) {
    const data = categoryArr[i].$;
    let type = pascalCase(data.type);
    if ((sequenceId === undefined) || (sequenceId === '')) { // current
        recentDataEntry = readFromHashCurrent(data.id, path)
    } else { // current?at
      recentDataEntry = readFromCircularBuffer(sequenceId, data.id, uuid, path)
    }

    if(recentDataEntry){
      dataItem[j++] = buildDataItem(recentDataEntry, data, type, category)
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
  const DataItemVar = {};
  const eventArr = [];
  const sample = [];
  const condition = [];
  let eventObj;
  let sampleObj;
  let conditionObj;

  for (let i = 0, j = 0, k = 0, l = 0; i < dataItemsArr.length; i++) {
    const category = dataItemsArr[i].$.category;
    if (category === 'EVENT') {
      eventArr[j++] = dataItemsArr[i]
    } else if (category === 'SAMPLE') {
      sample[k++] = dataItemsArr[i]
    } else { // if (category === 'CONDITION')
      condition[l++] = dataItemsArr[i]
    }
  }

  if (count) {
    eventObj = createSampleDataItem(eventArr, sequenceId, 'EVENT', uuid, count, path);
    sampleObj = createSampleDataItem(sample, sequenceId, 'SAMPLE', uuid, count, path);
    conditionObj = createSampleDataItem(condition, sequenceId, 'CONDITION', uuid, count, path)
  } else {
    eventObj = createDataItem(eventArr, sequenceId, 'EVENT', uuid, path);
    sampleObj = createDataItem(sample, sequenceId, 'SAMPLE', uuid, path);
    conditionObj = createDataItemsForCondition(condition, sequenceId, 'CONDITION', uuid, path)
  }

  DataItemVar.Event = eventObj;
  DataItemVar.Sample = sampleObj;
  DataItemVar.Condition = conditionObj;
  return DataItemVar
}

/* ******************************  ASSET reading ****************************** */
function sortByTime (arr) {
  const sortTime = R.sortBy(R.prop('time'));
  const result = sortTime(arr);
  return R.reverse(result)
}

function filterByCount (count, assetSet) {
  let assetCount = 0;
  let j = 0; let m = 0;
  const result = [];
  const assetId = [];
  const assetList = assetSet;
  if (!R.isEmpty(assetList)) {
    result[j++] = assetList[0];
    assetCount++;
    assetId[m++] = result[j - 1].assetId;
    for (let i = 1; (assetCount < count && i < assetList.length); i--) {
      let idPresent = false;
      for (let k = 0; k < assetId.length; k++) {
        if (assetList[i].assetId === assetId[k]) {
          idPresent = true
        }
      }
      if (!idPresent) {
        result[j++] = assetList[i];
        assetId[m++] = result[j - 1].assetId;
        assetCount++
      }
    }
  }
  return result
}

function filterAssets (assetData, type, count, removed, target, archetypeId) {
  let assetSet = assetData;
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
  assetSet = sortByTime(assetSet);
  if (count) {
    assetSet = filterByCount(count, assetSet)
  }
  return assetSet
}

function createAssetItemForAssets (assetDetails) {
  const cuttingTool = [];
  const obj = {};
  let i = 0;
  if (!R.isEmpty(assetDetails)) {
    R.map((k) => {
      if (k !== undefined) {
        const valueJSON = R.clone(k.value);
        if (k.assetType === 'CuttingTool') {
          delete valueJSON.CuttingTool.Description; // remove Description
          if(typeof(valueJSON.CuttingTool) === 'object'){
            cuttingTool[i++] = valueJSON.CuttingTool
          } else {
            cuttingTool[i++] = {
              _: valueJSON.CuttingTool,
              $: {}
            }
          }
          if(k.removed){
            cuttingTool[i - 1].$.removed = k.removed
          }
          cuttingTool[i - 1].$.assetId = k.assetId;
          cuttingTool[i - 1].$.timestamp = k.time;
          cuttingTool[i - 1].$.deviceUuid = k.uuid
        }
      }
      return cuttingTool // to make eslint happy
    }, assetDetails)
  }
  obj.CuttingTool = cuttingTool;
  return obj
}

function createAssetItem (assetDetails) {
  const obj = { CuttingTool: [] };
  if (assetDetails !== undefined) {
    const valueJSON = assetDetails.value;
    delete valueJSON.CuttingTool.Description; // remove Description
    obj.CuttingTool[0] = valueJSON.CuttingTool;
    if(typeof(obj.CuttingTool[0]) === 'object'){
      if(!obj.CuttingTool[0].$){
        obj.CuttingTool[0].$ = {}
      }
      obj.CuttingTool[0].$.assetId = assetDetails.assetId;
      obj.CuttingTool[0].$.timestamp = assetDetails.time;
      obj.CuttingTool[0].$.deviceUuid = assetDetails.uuid
    }
  }
  return obj
}

function readAssets (assetCollection, type, count, removed, target, archetypeId) {
  const assetData = [];
  let assetDetails;
  let i = 0;
  R.map((k) => {
    const obj = hashAssetCurrent.get(k);
    if (obj !== undefined) {
      assetData[i++] = obj
    }
    return assetData // eslint
  }, assetCollection);
  
  assetDetails = filterAssets(assetData, type, count, removed, target, archetypeId);
  //assetDetails = sortByTime(assetData)
  const assetResult = createAssetItemForAssets(assetDetails);

  return assetResult
}

function readAssetforId (assetId, type, count, removed, target, archetypeId) {
  const assetDetails = hashAssetCurrent.get(assetId);
  const assetResult = createAssetItem(assetDetails);
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
  hashCondition,
  addToHashCondition,
  hashLast,
  hashAssetCurrent,
  hashAdapters,
  hashDataItemsByName,
  hashDataItemsBySource,
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
  filterAssets,
  dividingPaths,
  setConfiguration,
  getConfiguredVal
};
