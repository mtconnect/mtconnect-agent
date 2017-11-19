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

const rp = require('request-promise');
const parse = require('xml-parser');
const url = require('url');
const { Client } = require('node-ssdp');
const EventEmitter = require('events');
const xpath = require('xpath');
const dom = require('xmldom').DOMParser;

const config = require('../configuration');
const log = config.logger;

class UpnpFinder extends EventEmitter {
  constructor ({ query, frequency }) {
    super();
    this.query = query;
    this.frequency = frequency;
    this.searching = null;
  
    this.client = new Client();
    this.client.on('response', this.device.bind(this));
    this.client.on('error', log.error.bind(log));
  }
  
  // parseHeaders Parse headers returned by UPnP server into info
  // @params [Object] Headers from SSDP search
  // @returns [Object] device information
  static parseHeaders({ LOCATION, USN }) {
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
  static parseDescription(description) {
    return new Promise((resolve, reject) => {
      const xml = parse(description);
      for (const child of xml.root.children) {
        if (child.name === 'URLBase') {
          resolve(child.content);
          return;
        }
      }
      
      reject(new Error('Cannot find URLBase'));
    });
  }
  
  emitDeviceXml(xml) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new dom().parseFromString(xml);
        const root = doc.documentElement;
        const namespace = root.namespaceURI;
        const select = xpath.useNamespaces({ m: namespace });
  
        const data = select('//m:Device/m:Description/m:Data/@href', doc, null);
        if (data.length > 0) {
          this.emit('device', { device: xml, data: data[0].value });
          resolve(xml);
        } else {
          reject(new Error('Cannot find data in Device XML'));
        }
      } catch(err) {
        log.error(`Cannot parse XML device: ${err.message}`);
        reject(err);
      }
    });
  }
  
  device(data) {
    const info = UpnpFinder.parseHeaders(data);
    const { hostname, port } = info;
    rp(`http://${hostname}:${port}/`)
      .then(UpnpFinder.parseDescription)
      .then(u => rp(`${u}/probe`))
      .then(this.emitDeviceXml.bind(this))
      .catch(err => log.error(err));
  }
  
  search() {
    this.searching = setInterval(() => {
      log.debug(this.query);
      this.client.search(this.query);
    }, this.frequency);
  }
  
  start() {
    this.search();
    return this;
  }
  
  stop() {
    if (this.searching) clearInterval(this.searching);
    this.client.stop();
    return this;
  }
}

module.exports = UpnpFinder;
