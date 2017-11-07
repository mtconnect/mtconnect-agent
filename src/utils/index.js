const request = require('co-request')
const parse = require('xml-parser')
const log = require('../config/logger')
const url = require('url')

module.exports = {
  // parseHeaders Parse headers returned by UPnP server into info
  // @params [Object] Headers from SSDP search
  // @returns [Object] device information
  parseHeaders ({ LOCATION, USN }) {
    const u = url.parse(LOCATION);
    const hostname = u.hostname, port = u.port;
    const [dummy, uuid] = USN.split(':');
    log.info(`Hostname: ${hostname} port: ${port}`);
    return { hostname, port, uuid };
  },

  // deviceXML pulls device xml from the device
  // @params [Object] device info + path (xml location)
  // @returns [*function] generator function
  * descriptionXML ({ hostname, port }) {
    if (!(hostname && port)) throw new Error('Missing required arguments')
    const { body } = yield request(`http://${hostname}:${port}/`)
    return body
  },

  * deviceXML(description){
    const url = parse(description).root.children[1].content
    const { body } = yield request(`${url}/probe`)
    return body
  }
}
