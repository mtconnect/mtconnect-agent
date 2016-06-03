// TODO Base filename should match the name of default export
const log = require('./config/logger');
const Client = require('node-ssdp').Client; // Control Point
const Loki = require('lokijs');
const util = require('util');
const net = require('net');

const agent = new Client();

const db = new Loki('agent-loki.json');
const devices = db.addCollection('devices');

// TODO Global list of active sockets

agent.on('response', (headers) => {
  // TODO Handle CACHE-CONTROL

  const headerData = JSON.stringify(headers, null, '  ');
  const data = JSON.parse(headerData);
  const location = data.LOCATION.split(':');

  const found = devices.find({ address: location[0], port: location[1] });

  // TODO Maybe remove old entries and insert the latest
  if (found.length < 1) {
    devices.insert({ address: location[0], port: location[1] });
  }
});

// Search for interested devices
setInterval(() => {
  agent.search('urn:schemas-upnp-org:service:VMC-3Axis:1');
}, 10000);

// TODO For each device in lokijs, create a socket and connect to it.
// Search for interested devices
setInterval(() => {
  const activeDevices = devices.find({});

  log.debug('activeDevices:');
  log.debug(util.inspect(activeDevices));

  activeDevices.forEach((d) => {
    const client = new net.Socket();

    client.connect(d.port, d.address, () => {
      console.log('Connected.');
    });

    client.on('data', (data) => {
      console.log(`Received: ${data}`);
    });

    client.on('close', () => {
      console.log('Connection closed');
    });
  });
}, 10000);
