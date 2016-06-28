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

// Imports - Internal

const log = require('./config/logger');

// Functions


/**
  * inputParsing get the data from adapter, do string parsing
  * @param {string} inputParsing
  *
  * returns jsonData with time and dataitem
  */
function inputParsing(inputString) { // ('2014-08-11T08:32:54.028533Z|avail|AVAILABLE')
  const inputParse = inputString.split('|');
  const totalDataItem = (inputParse.length - 1) / 2;
  const jsonData = {
    time: inputParse[0],
    dataitem: [],
  };
  for (let i = 0, j = 1; i < totalDataItem; i++, j += 2) {
    // to getrid of edge conditions eg: 2016-04-12T20:27:01.0530|logic1|NORMAL||||
    if (inputParse[j]) {
      // dataitem[i] = { name: (avail), value: (AVAILABLE) };
      jsonData.dataitem.push({ name: inputParse[j], value: inputParse[j + 1] });
    }
  }
  return jsonData;
}


/**
  * getUuid() returns the UUID
  *
  * @param  null
  *
  */
function getUuid() {
  const uuid = '000'; // TODO: insert the corresponding uuid
  return uuid;
}


/**
  * fillArray() creates an array of size n
  * and fills the array with numbers 0 to n
  *
  * @param {Number} n
  * returns the array
  */
function fillArray(n) {
  const arrayObj = Array.apply(null, Array(n));
  return arrayObj.map((x, i) => i);
}

/**
  * processErrorExit() logs an error message
  * and exits with status code 1.
  *
  * @param {String} message
  * @param {Boolean} exit
  */
function processError(message, exit) {
  log.error(`Error: ${message}`);

  if (exit) process.exit(1);
}

// Exports

module.exports = {
  getUuid,
  inputParsing,
  processError,
  fillArray,
};
