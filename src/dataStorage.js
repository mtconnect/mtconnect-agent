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

// Constants

const bufferSize = 10; // TODO: change it to the required buffer size

// Instances

const circularBuffer = new CBuffer(bufferSize); /* circular buffer */
const hashLast = new HashMap();
const hashCurrent = new HashMap();
const backUp = [];
let firstSequence;
let lastSequence;
let backUpVar = 0;


// Functions

/* ************************** Supporting functions ************************* */
/**
  * Check the array of dataitems for matching uuid, id and name
  *
  * @param arr {array}
  * @param uuidVal {String}
  * @param idVal {String}
  * @param nameVal {String}
  *
  * returns an array of filtered result
  *
  */


function filterChain(arr, uuidVal, idVal) {
  const filter = R.pipe(R.values,
                        R.filter((v) => v.uuid === uuidVal),
                        R.filter((v) => v.id === idVal));
  const result = filter(arr);
  return result;
}

/**
  * gets called when the circularBuffer is upto overflow
  * inserts the evicted data to hashLast
  * data - the data which will get evicted
  *
  *
  */
circularBuffer.overflow = (data) => {
  const uuidVal = data.uuid;
  const idVal = data.id;
  hashLast.set(idVal, data);

  //TODO: Delete after implementation completes
 /**************************************************************************************/
  // the 0th element will be the data to be evicted hence spliced from 1
  const cb = circularBuffer.slice(1, bufferSize);

  // checking the circularBuffer if any entry exist for the dataitem to be evicted
  const entryExist = filterChain(cb, uuidVal, idVal);

 // if no entry is present, data should be backed up.
  if (entryExist.length === 0) {
    backUp[backUpVar++] = data;
    return;
  }
  /**************************************************************************************/
  return;
};


/**
  * readFromBackUp() gets the latest
  * value of the backUp Array (evicted data absent in circular buffer)
  *
  * @param {String} idVal
  * @param {String} uuidVal
  * @param {String} nameVal
  *
  * return the latest entry for that dataitem
  *
  */
function readFromBackUp(uuidVal, idVal, nameVal) {
  log.debug('readFromBackUp', uuidVal, idVal, nameVal);
  const filteredList = filterChain(backUp, uuidVal, idVal);
  log.debug('filteredList', filteredList);
  const latestEntry = filteredList[filteredList.length - 1];
  return latestEntry;
}


// function calculateCheckPoint(hC, fS, lS, obj) {
//   const k = circularBuffer.toArray();
//   const arr = [];
//   let checkPoint;
//   if (k.length === 0) {
//     checkPoint = hashLast;
//   } else {
//     const keys = hashCurrent.keys();
//     R.map((c) => {
//       const len = circularBuffer.length;
//
//       R.findLast((a) => {
//         let j = 0;
//         //console.log(a.sequenceId, c)
//         // R.propEq(id, c)
//         if (a.id === c) {
//           arr[j++] = a.sequenceId;
//         }
//
//         // console.log('***************************************************')
//         // console.log(require('util').inspect(k, { depth: null }));
//         // console.log('---------------------------------------------------')
//
//       }, k);
//       // console.log(require('util').inspect(arr, { depth: null }));
//       // console.log('***************************************************')
//       // Try R.find
//       // for (let i = len - 1, j = 0; i >= 0; i--) {
//       //   if (k[i].sequenceId === c) {
//       //     arr[j++] = k[i].sequenceId;
//       //
//       //   }
//       //
//       // }
//
//     }, keys);
//
//   }
//   return checkPoint;
  //console.log('checkPoint', checkPoint)
// }


/**
  * updating the circular buffer after every insertion into DB
  *
  * @param obj = jsonData inserted in lokijs
  * { sequenceId: 0, id:'dtop_2', uuid:'000', time: '2',
  *    dataItemName:'avail', value: 'AVAILABLE' }
  *
  */

function updateCircularBuffer(obj) {
  let checkPoint;
  // const k = circularBuffer.toArray();
  // if (k.length !== 0) {
  //   firstSequence = k[0].sequenceId;
  //   lastSequence = k[circularBuffer.length-1].sequenceId
  // } else {
  //   firstSequence = 0;
  //   lastSequence = 0;
  // }
  //checkPoint = calculateCheckPoint(hashCurrent,firstSequence,lastSequence,obj);
  circularBuffer.push({ dataItemName: obj.dataItemName,
                        uuid: obj.uuid,
                        id: obj.id,
                        value: obj.value,
                        sequenceId: obj.sequenceId,
                        time: obj.time });

  return;
}


/**
  * readFromCircularBuffer() gets the latest
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
function readFromCircularBuffer(ptr, idVal, uuidVal, nameVal) {
  const cbArr = ptr.toArray();
  const latestEntry = filterChain(cbArr, uuidVal, idVal);
  let result = latestEntry[latestEntry.length - 1];
  if (result === undefined) {
    log.debug(' To be read from backUp');
    result = readFromBackUp(uuidVal, idVal, nameVal);
  }
  return result;
}

/**
  * pascalCase() converts the string to pascal case
  * @param {String} str
  * return res
  *
  * Eg. str = hello_World  res= Hello_World
  * Eg. str = helloworld   res= Helloworld
  */
function pascalCase(strReceived) {
  return strReceived.replace(/\w\S*/g,
    (txt) => {
      const str = txt.split('_');
      let res = '';
      if (str) {
        let str0 = '';
        let str1 = '';
        str0 = str[0].charAt(0).toUpperCase() + str[0].substr(1).toLowerCase();
        if (str[1]) {
          str1 = str[1].charAt(0).toUpperCase() + str[1].substr(1).toLowerCase();
        }
        res = str0 + str1;
      }
      return res;
    });
}

/**
  * createDataItem creates the dataItem with recent value
  * and append name and subType if present and associate it to Object type
  *
  * @param {Object} categoryArr - Array of EVENT or SAMPLE
  * @param {Object} circularBufferPtr
  * @param {String} uuid
  * return dataItem
  */

function createDataItem(categoryArr, circularBufferPtr, uuid) {
  // console.log(require('util').inspect(categoryArr, { depth: null }));
  // console.log(require('util').inspect(circularBufferPtr.data, { depth: null }));
  const recentDataEntry = [];
  const dataItem = [];

  for (let i = 0; i < categoryArr.length; i++) {
    const data = categoryArr[i].$;
    const type = pascalCase(data.type);
    recentDataEntry[i] = readFromCircularBuffer(circularBufferPtr, data.id, uuid, data.name);
    //console.log(require('util').inspect(recentDataEntry[i], { depth: null }));
    const obj = { $: { dataItemId: data.id,
                       sequence: recentDataEntry[i].sequenceId,
                       timestamp: recentDataEntry[i].time },
                  _: recentDataEntry[i].value };

    if (data.name) {
      obj.$.name = data.name;
    }
    if (data.subType) {
      obj.$.subType = data.subType;
    }

    dataItem[i] = R.assoc(type, obj, {});
  }
  return dataItem;
}

/**
  * createDataItem creates the dataItem with recent value
  * and append name and subType if present and associate it to Value
  *
  * @param {Object} categoryArr - Array of Condition
  * @param {Object} circularBufferPtr
  * @param {String} uuid
  * return dataItem
  */
function createCondition(categoryArr, circularBufferPtr, uuid) {
  const recentDataEntry = [];
  const dataItem = [];

  for (let i = 0; i < categoryArr.length; i++) {
    const data = categoryArr[i].$;
    const type = data.type;
    recentDataEntry[i] = readFromCircularBuffer(circularBufferPtr, data.id, uuid, data.name);
    const obj = { $: { dataItemId: data.id,
                    sequence: recentDataEntry[i].sequenceId,
                    timestamp: recentDataEntry[i].time,
                    type } };
    if (data.name) {
      obj.$.name = data.name;
    }
    if (data.subType) {
      obj.$.subType = data.subType;
    }
    dataItem[i] = R.assoc(pascalCase(recentDataEntry[i].value), obj, {});
  }
  return dataItem;
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
function categoriseDataItem(latestSchema, dataItemsArr, circularBufferPtr) {
  const DataItemVar = {};
  const eventArr = [];
  const sample = [];
  const condition = [];
  const uuid = latestSchema[0].device.$.uuid;

  for (let i = 0, j = 0, k = 0, l = 0; i < dataItemsArr.length; i++) {
    const category = dataItemsArr[i].$.category;
    if (category === 'EVENT') {
      eventArr[j++] = dataItemsArr[i];
    } else if (category === 'SAMPLE') {
      sample[k++] = dataItemsArr[i];
    } else if (category === 'CONDITION') {
      condition[l++] = dataItemsArr[i];
    }
  }

  const eventObj = createDataItem(eventArr, circularBufferPtr, uuid);
  const sampleObj = createDataItem(sample, circularBufferPtr, uuid);
  const conditionObj = createCondition(condition, circularBufferPtr, uuid);

  DataItemVar.Event = eventObj;
  DataItemVar.Sample = sampleObj;
  DataItemVar.Condition = conditionObj;

  return DataItemVar;
}


// Exports

module.exports = {
  categoriseDataItem,
  updateCircularBuffer,
  circularBuffer,
  hashCurrent,
  hashLast,
  readFromCircularBuffer,
  bufferSize,
  pascalCase,
};
