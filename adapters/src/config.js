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

const ip = require('ip');
const nconf = require('nconf');
const bunyan = require('bunyan');

nconf.argv().env('__');
const name = nconf.get('name');
nconf.file(name, `./adapters/simulator/config/${name.toLowerCase()}.json`);
nconf.file('adapter_default', './adapters/simulator/config/default.json');
nconf.defaults({app: {address: ip.address()}});

nconf.logger = bunyan.createLogger({
    name: nconf.get('app:name'),
    version: nconf.get('app:version'),
    logDir: nconf.get('logging:logDir'),
    level: nconf.get('logging:logLevel'),
});

module.exports = nconf;
