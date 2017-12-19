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

const R = require('ramda');
const {currentImplementation, giveResponse, errResponse, handleMultilineStream, validityCheck} = require('../utils/handlers');
const common = require('../common');
const devices = require('../store');

function* current() {
    // eg: reqPath = /sample?path=//Device[@name="VMC-3Axis"]//Hydraulic&from=97&count=5
    let uuidCollection;

    if (!this.params.device) {
        uuidCollection = common.getAllDeviceUuids(devices);
    } else {
        uuidCollection = [common.getDeviceUuid(this.params.device)];
    }

    if (R.isEmpty(uuidCollection) || uuidCollection[0] === undefined) {
        return errResponse(this, this.request.type, 'NO_DEVICE', this.params.device);
    }

    // TODO: implement casting for params parsing
    // default values will fail validation system
    // consider using db gateway for casting
    // start params parser
    const at = Number(this.query.at) || undefined;
    const path = this.query.path;
    const freq = Number(this.query.frequency) || Number(this.query.interval) || undefined;

    if (freq) {
        if (at) {
            return errResponse(
                this,
                this.request.type,
                'INVALID_REQUEST'
            );
        }
        return handleMultilineStream(
            this,
            path,
            uuidCollection,
            freq,
            'current',
            at,
            undefined,
            this.request.type
        );
    }
    // end params parser
    const obj = validityCheck('current', uuidCollection, path, at);
    if (obj.valid) {
        const jsonData = currentImplementation(this, this.request.type, at, path, uuidCollection);
        return giveResponse(jsonData, this.request.type, this);
    }
    return errResponse(this, this.request.type, 'validityCheck', obj.errorJSON);
}

module.exports = (router) => {
    router
        .get('/current', current)
        .get('/:device/current', current);
};
