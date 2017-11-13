// Adapter is device's SSDP server
// * broadcast UPnP
// Start doesn't tell us when server is ready
// https://github.com/diversario/node-ssdp/issues/70
// it is ok but unpredictable when testing

const config = require('./config');
const log = config.logger;
const { Server } = require('node-ssdp');

let server;

function stop () {
  if (!server) return;
  server.stop();
  server = false;
}

// Start adapter
// @retrurns promise
function start () {
  const ssdpOptions = {
    location: `http://${config.get('app:address')}:${config.get('app:filePort')}/`,
    udn: `uuid:${config.get('app:uuid')}`,
    adInterval: 10000,
    allowWildcards: true,
  };

  // return immediately if server is running
  if (server) return new Promise((resolve, reject) => resolve());
  
  server = new Server(ssdpOptions);
  server.on('advertise-alive', log.debug.bind(log));
  server.on('advertise-bye', () => setImmediate(log.debug.bind(log)));
  server.on('error', log.error.bind(log));
  server.addUSN(`urn:mtconnect-org:service:${config.get('app:urn')}:1`);
  process.on('exit', server.stop.bind(server));
  server.start();
  
  return new Promise((resolve, reject) => {
    if (!server.sock) reject();
    server.sock.once('listening', resolve);
    server.sock.once('error', reject);
  });
}

module.exports = { start, stop };
