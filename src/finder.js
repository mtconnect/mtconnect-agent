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


function onDevice() {
  return function handle(headers) {
    co(function *() {
      const info = parseHeaders(headers);
      const xmlString = yield deviceXML(Object.assign({ path }, info));
      console.log(mtConnectValidate(xmlString));
    }).catch(log.error.bind(log));
  };
}

finder.on('response', onDevice());

finder.on('error', console.error.bind(console));
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
