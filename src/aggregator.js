// In charge of sniffing network and pulling devices into the db

const co = require('co');
const config = require('./config/config');
const { descriptionXML, deviceXML } = require('./utils');
const Finder = require('./finder');
const lokijs = require('./lokijs');
const log = require('./config/logger');
const common = require('./common');
const devices = require('./store');
const { urnSearch, deviceSearchInterval } = config.app.agent;
const query = `urn:schemas-mtconnect-org:service:${urnSearch}`;
const finder = new Finder({ query, frequency: deviceSearchInterval });
const R = require('ramda');
const net = require('net');
const rl = require('readline');


devices.on('delete', (obj) => {
  lokijs.updateBufferOnDisconnect(obj.uuid)
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

function connectToDevice ({ ip, port, uuid }) {
  log.info(`Connecting to ${ip}:${port} for ${uuid}`);
  let heartbeatTimeout = null;

  const socket = net.createConnection(port, ip);
  socket.setNoDelay(true);
  const reader = rl.createInterface({ input: socket, output: socket });
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
        socket.end()
      }, time * 2);
      setTimeout(() => {
        if (!socket.destroyed) {
          try {
            socket.write('* PING\n');
          } catch (ex) {
            log.warn('Cannot write ping to socket');
          }
        }
      }, time)
    } else {
      common.parsing(String(line).trim(), uuid)
    }
  });

  reader.on('close', () => {
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
    }

    const found = devices.find({ $and: [{ address: ip }, { port }] });
    if (found.length > 0) {
      devices.remove(found);
    }
    log.debug('Connection closed');
  });

  devices.insert({ address: ip, port, uuid })
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
function handleDevice({ uuid }) {
  return ([ip, port]) => {
    const found = devices.find({ $and: [{ address: ip }, { port }] });
    const uuidFound = common.duplicateUuidCheck(uuid, devices);
    if ((found.length < 1) && (uuidFound.length < 1)) {
      connectToDevice({ ip, port, uuid });
    }
  }
}

function validateXML(schema) {
  return new Promise((resolve, reject) => {
    if (common.mtConnectValidate(schema)) {
      resolve(schema);
    } else {
      reject('Not valid XML');
    }
  })
}

function addSchema(schema) {
  return new Promise((resolve, reject) => {
    const ipAndPort = lokijs.updateSchemaCollection(schema);
    if (ipAndPort) {
      resolve(ipAndPort)
    } else {
      reject('Something happened in updateSchemaCollection');
    }
  })
}

const checkAndUpdate = R.pipeP(validateXML, addSchema);

function onDevice (info) {
  co(descriptionXML(info))
    .then(xml => co(deviceXML(xml)))
    .then(checkAndUpdate)
    .then(handleDevice(info))
    .catch(error => log.error(error));
}

finder.on('device', onDevice);

module.exports = finder;
