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

// In charge of sniffing network and pulling devices into the db
const co = require('co');
const config = require('./configuration');
const log = config.logger;
const Finder = require('./discovery/upnp');
const lokijs = require('./lokijs');
const common = require('./common');
const devices = require('./store');
const {urnSearch, deviceSearchInterval} = config.get('app:discovery:upnp');
const query = `urn:schemas-mtconnect-org:service:${urnSearch}`;
const finder = new Finder({query, frequency: deviceSearchInterval});
const R = require('ramda');
const net = require('net');
const rl = require('readline');


devices.on('delete', (obj) => {
    lokijs.updateBufferOnDisconnect(obj.uuid);
});

/**
 * connectToDevice() create socket connection to device
 *
 * @param {Object} address
 * @param {Object} port
 *
 * return uuid
 *
 */

function connectToDevice({hostname, port, uuid}) {
    log.info(`Connecting to ${hostname}:${port} for ${uuid}`);
    let heartbeatTimeout = null;

    const socket = net.createConnection(port, hostname);
    socket.setNoDelay(true);
    const reader = rl.createInterface({input: socket, output: socket});
    socket.write('* PING\n');

    reader.on('line', line => {
        log.info(`Recevied: ${line}`);

        const pong = line.match(/^\* PONG ([0-9]+)/);
        if (pong) {
            if (heartbeatTimeout) {
                clearTimeout(heartbeatTimeout);
                heartbeatTimeout = null;
            }

            // Process command
            const time = pong[1];
            heartbeatTimeout = setTimeout(() => {
                log.error(`Adapter unresponsive for more than ${time * 2}ms, closing`);
                reader.close();
                socket.end();
            }, time * 2);
            setTimeout(() => {
                if (!socket.destroyed) {
                    try {
                        socket.write('* PING\n');
                    } catch (ex) {
                        log.warn('Cannot write ping to socket');
                    }
                }
            }, time);
        } else {
            common.parsing(String(line).trim(), uuid);
        }
    });

    reader.on('close', () => {
        if (heartbeatTimeout) {
            clearTimeout(heartbeatTimeout);
            heartbeatTimeout = null;
        }

        const found = devices.find({$and: [{address: hostname}, {port}]});
        if (found.length > 0) {
            devices.remove(found);
        }
        log.debug('Connection closed');
    });

    devices.insert({address: hostname, port, uuid});
}

/**
 * addDevice()
 *
 * @param {String} ip
 * @param {Number} port
 * @param {String} uuid
 *
 * returns null
 */
function handleDevice({hostname, port, uuid}) {
    const found = devices.find({$and: [{address: hostname}, {port}]});
    const uuidFound = common.duplicateUuidCheck(uuid, devices);
    if ((found.length < 1) && (uuidFound.length < 1)) {
        connectToDevice({hostname, port, uuid});
    }
}

function addSchema(schema) {
    return new Promise((resolve, reject) => {
        if (common.mtConnectValidate(schema)) {
            const ipAndPort = lokijs.updateSchemaCollection(schema);
            if (ipAndPort) {
                resolve(ipAndPort);
            } else {
                reject('Something happened in updateSchemaCollection');
            }
        }
        else {
            reject('Not valid XML');
        }
    });
}

function onDevice({schema, hostname, port, uuid}) {
    co(addSchema(schema))
        .then(handleDevice({hostname, port, uuid}))
        .catch(error => log.error(error));
}

finder.on('device', onDevice);

module.exports = finder;
