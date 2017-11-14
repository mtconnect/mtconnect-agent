const request = require('co-request');
const parse = require('xml-parser');
const url = require('url');
const { Client } = require('node-ssdp');
const wait = require('co-wait');
const co = require('co');
const EventEmitter = require('events');

const config = require('../configuration');
const log = config.logger;

class UpnpFinder extends EventEmitter {
  constructor ({ query, frequency }) {
    super();
    this.query = query;
    this.frequency = frequency;
    this.searching = false;
  
    this.client = new Client();
    this.client.on('response', this.device.bind(this));
    this.client.on('error', log.error.bind(log));
  }
  
  // parseHeaders Parse headers returned by UPnP server into info
  // @params [Object] Headers from SSDP search
  // @returns [Object] device information
  parseHeaders ({ LOCATION, USN }) {
    const u = url.parse(LOCATION);
    const hostname = u.hostname;
    const port = u.port;
    const usn = USN.split(':');
    const uuid = usn[0] === 'uuid' ? usn[1] : usn[0];
    log.info(`UUID: ${uuid} – Hostname: ${hostname} port: ${port}`);
    return { hostname, port, uuid };
  }
  
  // deviceXML pulls device xml from the device
  // @params [Object] device info + path (xml location)
  // @returns [*function] generator function
  static* descriptionXML ({ hostname, port }) {
    if (!(hostname && port)) throw new Error('Missing required arguments');
    const { body } = yield request(`http://${hostname}:${port}/`);
    return body;
  }
  
  static* deviceXML(description) {
    const u = parse(description).root.children[1].content;
    const { body } = yield request(`${u}/probe`);
    return body;
  }
  
  device (data) {
    const info = this.parseHeaders(data);
    this.emit('device', info);
  }
  
  * search () {
    while (this.searching) {
      log.debug(this.query);
      this.client.search(this.query);
      yield wait(this.frequency);
    }
  }
  
  start () {
    this.searching = true;
    co(this.search.bind(this)).catch(log.error.bind(log));
  }
  
  stop () {
    this.searching = false;
    this.client.stop();
  }
}

module.exports = UpnpFinder;
