// Adapter is device's SSDP server
// * broadcast UPnP

const log = require('../config/logger');
const common = require('../common');
const config = require('../config/config');
const ip = require('ip').address();
const { uuid, urn, machinePort, filePort } = config.app.simulator;
const SSDP = require('node-ssdp').Server;

const ssdpOptions = {
  location: `${ip}:${machinePort}:${filePort}`,
  udn: uuid,
  adInterval: 10000,
  allowWildcards: true,
};

const server = new SSDP(ssdpOptions);
server.on('advertise-alive', log.debug.bind(this));
server.on('advertise-bye', log.debug.bind(this));
server.on('error', (err) => {
  common.processError(err, true);
});

server.addUSN(`urn:schemas-mtconnect-org:service:${urn}:1`);

process.on('exit', server.stop);

server.start();
