
const request = require('co-request');
const parse = require('xml-parser');
const log = require('../config/logger');
const url = require('url');

module.exports = {
  // parseHeaders Parse headers returned by UPnP server into info
  // @params [Object] Headers from SSDP search
  // @returns [Object] device information
  parseHeaders({ LOCATION, USN }) {
    const u = url.parse(LOCATION);
    const hostname = u.hostname;
    const port = u.port;
    const uuid = USN.split(':')[1];
    log.info(`Hostname: ${hostname} port: ${port}`);
    return { hostname, port, uuid };
  },

  // deviceXML pulls device xml from the device
  // @params [Object] device info + path (xml location)
  // @returns [*function] generator function
  * descriptionXML ({ hostname, port }) {
    if (!(hostname && port)) throw new Error('Missing required arguments');
    const { body } = yield request(`http://${hostname}:${port}/`);
    return body
  },

  * deviceXML(description) {
    const u = parse(description).root.children[1].content;
    const { body } = yield request(`${u}/probe`);
    return body
  },
};
