// Finder is a stream responsible for:
// * finding new devices on the network
// * emit new event when one found
//

const { Client } = require('node-ssdp');
const config = require('./config/config');
const { mtConnectValidate } = require('./common');
const log = require('./config/logger');

const { parseHeaders, deviceXML } = require('./utils');

const { deviceSearchInterval, urnSearch, path } = config.app.agent;

const co = require('co');
const wait = require('co-wait');
const finder = new Client();

/**
  * addDevice()
  *
  * @param {String} hostname
  * @param {Number} portNumber
  * @param {String} uuid
  *
  * returns null
  */
function addDevice(hostname, portNumber, uuid) {
  const found = devices.find({ '$and': [{ hostname }, { port: portNumber }] });
  const uuidFound = common.duplicateUuidCheck(uuid, devices);

  if ((found.length < 1) && (uuidFound.length < 1)) {
    connectToDevice(hostname, portNumber, uuid);
  }
}


function onDevice() {
  return function handle(headers) {
    co(function *() {
      const info = parseHeaders(headers);
      const xmlString = yield deviceXML(Object.assign({ path }, info));
      const validXml = mtConnectValidate(xmlString);
      if (!validXml) throw new Error('Error: MTConnect validation failed');
      // addDevice(hostname, portNumber, uuid);
      // dupCheck = lokijs.updateSchemaCollection(data);
      // if a duplicateId exist, exit process.
      // if (dupCheck) {
      //   stopAgent();
      //   process.exit();
      // }

    }).catch(log.error.bind(log));
  };
}

finder.on('response', onDevice());

finder.on('error', log.error.bind(log));
/**
  * searchDevices search for interested devices periodically
  * @param null
  * returns null
  */
function *search() {
  while (true) {
    finder.search(`urn:schemas-mtconnect-org:service:${urnSearch}`);
    yield wait(deviceSearchInterval);
  }
}

co(search());
