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

// const log = require('./config/logger');
const config = require('./config/config');

// Constants

const bufferSize = config.app.agent.bufferSize;

// Instances

const circularBuffer = new CBuffer(bufferSize); /* circular buffer */
const hashLast = new HashMap();
const hashCurrent = new HashMap();
// let firstSequence;
// let lastSequence;

// Functions

/* ************************** Supporting functions ************************* */
/**
  * gets called when the circularBuffer is upto overflow
  * inserts the evicted data to hashLast
  * data - the data which will get evicted
  *
  */
circularBuffer.overflow = (data) => {
  const idVal = data.id;
  hashLast.set(idVal, data);
  return;
};


function calculateCheckPoint(obj) {
  const k = circularBuffer.toArray();
  const objId = obj.id;
  let checkPoint;
  if (k.length === 0) {
    checkPoint = -1;
  } else {
    const keys = hashCurrent.keys();
    const arr = [];
    let j = 0;
    R.map((c) => {
      if (c !== objId) {
        const index = (R.findLastIndex(R.propEq('id', c))(k));
        // if id not present in circular buffer
        if (index === -1) {
          arr[j++] = -1;
        } else {
          arr[j++] = k[index].sequenceId;
        }
      }
      return 0; // to make eslint happy
    }, keys);
    // smallest sequuence id
    checkPoint = R.sort((a, b) => a - b)(arr)[0];
  }
  return checkPoint;
}


/**
  * updating the circular buffer after every insertion into DB
  *
  * @param obj = jsonData inserted in lokijs
  * { sequenceId: 0, id:'dtop_2', uuid:'000', time: '2',
  *    dataItemName:'avail', value: 'AVAILABLE' }
  *
  */

function updateCircularBuffer(obj) {
  // TODO: Might be needed for current/ current?at implementation
  // const k = circularBuffer.toArray();
  // if (k.length !== 0) {
  //   firstSequence = k[0].sequenceId;
  //   lastSequence = k[circularBuffer.length - 1].sequenceId;
  // } else {
  //   firstSequence = 0;
  //   lastSequence = 0;
  // }
  const checkPoint = calculateCheckPoint(obj);
  circularBuffer.push({ dataItemName: obj.dataItemName,
                        uuid: obj.uuid,
                        id: obj.id,
                        value: obj.value,
                        sequenceId: obj.sequenceId,
                        time: obj.time,
                        checkPoint,
                       });
  return;
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
function readFromHashCurrent(idVal) {
  const result = hashCurrent.get(idVal);
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

function createDataItem(categoryArr) {
  const recentDataEntry = [];
  const dataItem = [];

  for (let i = 0; i < categoryArr.length; i++) {
    const data = categoryArr[i].$;
    const type = pascalCase(data.type);
    recentDataEntry[i] = readFromHashCurrent(data.id);
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
  * createCondition creates the dataItem with recent value
  * and append name and subType if present and associate it to Value
  *
  * @param {Object} categoryArr - Array of Condition
  * @param {Object} circularBufferPtr
  * @param {String} uuid
  * return dataItem
  */
function createCondition(categoryArr) {
  const recentDataEntry = [];
  const dataItem = [];

  for (let i = 0; i < categoryArr.length; i++) {
    const data = categoryArr[i].$;
    const type = data.type;
    recentDataEntry[i] = readFromHashCurrent(data.id);
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
function categoriseDataItem(latestSchema, dataItemsArr) {
  const DataItemVar = {};
  const eventArr = [];
  const sample = [];
  const condition = [];

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

  const eventObj = createDataItem(eventArr);
  const sampleObj = createDataItem(sample);
  const conditionObj = createCondition(condition);

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
  readFromHashCurrent,
  bufferSize,
  pascalCase,
};
