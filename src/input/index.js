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

const conf = require('../configuration');

const log = conf.logger;
const url = require('url');

const R = require('ramda');

/**
 * The input manager is a singleton object that uses the configuration app:index to create a set of
 * available input sources.
 */
class InputManager {
  /**
   * Create an input manager singleton.
   * @param {deviceManager} Provides information about the devices. The device manager will be used to
   * map from the data item names or ids to the data items as given in the intput stream.
   */
  constructor(deviceManager) {
    const inputs = conf.get('app:input');
    this.deviceManager = deviceManager;
    this.managers = R.mapObjIndexed((o, k) => {
      const Input = require(`./${k}`);
      return new Input(this.deviceManager);
    }, inputs);
  }
  
  /**
   * Connect to a data source with a data source uri.
   * @param {uri} A URI that indicates how to connect to the data source. Ex. shdr:192.168.1.20:7878/
   */
  connectTo(uri) {
    const u = url.parse(uri);
    const protocol = u.protocol.replace(/:$/, '');
    const manager = this.managers[protocol];
    if (manager) {
      manager.connectTo(uri);
    } else {
      log.error(`Cannot resolve input manager for ${uri}`);
      throw Error(`Cannot resolve input manager for ${uri}`);
    }
  }
}

module.exports = InputManager;
