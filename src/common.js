/*
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

function fillArray(n) {
  const arr = Array.apply(null, Array(n));
  return arr.map((x, i) => i);
}


/*
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
  processError,
  fillArray,
};
