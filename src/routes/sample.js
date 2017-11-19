/*
 * Copyright Copyright 2017, VIMANA, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

const { sampleImplementation, giveResponse, errResponse, handleMultilineStream, validityCheck } = require('../utils/handlers');
const common = require('../common');
const { getSequence } = require('../data_storage');
const devices = require('../store');

function * sample () {
  // eg: reqPath = /sample?path=//Device[@name="VMC-3Axis"]//Hydraulic&from=97&count=5
  let uuidCollection;

  if (!this.params.device) {
    uuidCollection = common.getAllDeviceUuids(devices);
  } else {
    uuidCollection = [common.getDeviceUuid(this.params.device)];
  }

  // TODO: implement casting for params parsing
  // default values will fail validation system
  // consider using db gateway for casting
  // start params parser
  let count = Number(this.query.count);
  if (isNaN(count)) count = 100;
  const path = this.query.path;
  const freq = Number(this.query.frequency) || Number(this.query.interval);
  let from;
  if (this.query.from) {
    from = Number(this.query.from);
  } else {
    from = getSequence().firstSequence;
  }

  // end params parser
  if (freq) {
    return handleMultilineStream(
      this,
      path,
      uuidCollection,
      freq,
      'sample',
      from,
      count,
      this.request.type
    );
  }

  const obj = validityCheck('sample', uuidCollection, path, from, count);
  if (obj.valid) {
    const jsonData = sampleImplementation(this, this.request.type, from, count, path, uuidCollection);
    // console.log(JSON.stringify(jsonData))
    return giveResponse(jsonData, this.request.type, this);
  }
  return errResponse(this, this.request.type, 'validityCheck', obj.errorJSON);
}

module.exports = (router) => {
  router
    .get('/sample', sample)
    .get('/:device/sample', sample);
};
