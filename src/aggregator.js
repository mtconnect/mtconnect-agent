// In charge of sniffing network and pulling devices into the db
const co = require('co');
const config = require('./config/config');
const net = require('net');
const Loki = require('lokijs');
const { deviceXML } = require('./utils');
const Finder = require('./finder');
const lokijs = require('./lokijs');
const log = require('./config/logger');
const common = require('./common');
const es = require('event-stream');
const Db = new Loki('agent-loki.json');
const devices = Db.addCollection('devices');
const { urnSearch, deviceSearchInterval, path } = config.app.agent;
const query = `urn:schemas-mtconnect-org:service:${urnSearch}`;
const finder = new Finder({ query, frequency: deviceSearchInterval });
const c = new net.Socket(); // client-adapter

/**
  * processSHDR() process SHDR string
  *
  * @param {Object} data
  *
  * return uuid
  *
  */
function processSHDR(data, uuid) {
  log.debug(data.toString());
  const dataString = String(data).split('\r');
  const parsedInput = common.inputParsing(dataString[0], uuid);
  lokijs.dataCollectionUpdate(parsedInput, uuid);
}

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

function connectToDevice({ ip, port, uuid }) {
  console.log(arguments)
  c.connect(port, ip, () => {
    log.debug(`Connected: port:${port} and ip: ${ip}.`);
  });

  c.on('data', () => {})
    .pipe(es.split())
    .pipe(es.map((data, cb) => cb(null, processSHDR(data, uuid))));

  c.on('error', (err) => { // Remove device
    if (err.errno === 'ECONNREFUSED') {
      const found = devices.find({ $and: [{ address: err.address }, { port: err.port }] });
      if (found.length > 0) { devices.remove(found); }
    }
  });

  c.on('close', () => {
    const found = devices.find({ $and: [{ address: ip }, { port }] });
    if (found.length > 0) { devices.remove(found); }
    log.debug('Connection closed');
  });

  devices.insert({ address: ip, port, uuid });
}

/**
  * addDevice()
  *
  * @param {String} hostname
  * @param {Number} portNumber
  * @param {String} uuid
  *
  * returns null
  */
function handleDevice({ ip, port, uuid }) {
  return function addDevice(xml) {
    if (!common.mtConnectValidate(xml)) return;
    if (lokijs.updateSchemaCollection(xml)) return;
    const found = devices.find({ $and: [{ hostname: ip }, { port }] });
    const uuidFound = common.duplicateUuidCheck(uuid, devices);
    if ((found.length < 1) && (uuidFound.length < 1)) {
      connectToDevice({ ip, port, uuid });
    }
  };
}

function onDevice(info) {
  co(deviceXML(Object.assign({ path }, info))).then(handleDevice(info));
}

finder.on('device', onDevice);

module.exports = finder;
