// Adapter is device's SSDP server
// * broadcast UPnP

const log = require('../config/logger');
const config = require('../config/config');
const ip = require('ip').address();
const { uuid, urn, machinePort, filePort } = config.app.simulator;
const { Server } = require('node-ssdp');

const ssdpOptions = {
  location: `${ip}:${machinePort}:${filePort}`,
  udn: uuid,
  adInterval: 10000,
  allowWildcards: true,
};

let server;

function stop() {
  if (!server) return;
  server.start();
}

function start() {
  if (server) return server;
  server = new Server(ssdpOptions);
  server.on('advertise-alive', log.debug.bind(log));
  server.on('advertise-bye', log.debug.bind(log));
  server.on('error', log.error.bind(log));
  server.addUSN(`urn:schemas-mtconnect-org:service:${urn}:1`);
  process.on('exit', server.stop.bind(server));
  return server;
}

module.exports = { start, stop };
