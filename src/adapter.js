// TODO: Use module import/export
const log = require('./config/logger');
const ip = require('ip');

/*
 *  Machine data
 */

const fs = require('fs');
const net = require('net');
const http = require('http');
const MACHINE_PORT = 8081;
const SERVE_FILE_PORT = 8080;
const UUID = 'innovaluesthailand_CINCOMA26-1_b77e26';
const nodeStatic = require('node-static');

const machine = net.createServer();
const SSDP = require('node-ssdp').Server;
const file = new nodeStatic.Server('./public');
const adapter = new SSDP({ location: `${ip.address()}:${MACHINE_PORT}`, udn:`${UUID}` });

// TODO: Fix description and params in functions
function* machineDataGenerator() {
  const data = fs.readFileSync('./public/sample_test.txt').toString().split('\n');

  yield* data[Symbol.iterator]();
}

machine.on('connection', (socket) => {
  const machineData = machineDataGenerator();

  function writeData() {
    const data = machineData.next().value;

    if (data) {
      setTimeout(() => {
        socket.write(data);
        writeData(socket);
      }, Math.floor(Math.random() * 3000)); // Simulate delay
    } else {
      socket.destroy();
    }
  }

  writeData(socket);
});

machine.listen(MACHINE_PORT, ip.address());

log.info('Starting machine TCP server on port %d', MACHINE_PORT);

/*
 *  Serve Device definition file
 */

const fileServer = http.createServer((request, response) => {
  request.addListener('end', () => {
    /*
     *  Serve files!
     */
    file.serve(request, response);
  }).resume();
});

fileServer.listen(SERVE_FILE_PORT);

log.info('Starting HTTP web server on port %d', SERVE_FILE_PORT);

/*
 *  SSDP
 */

adapter.addUSN('urn:schemas-upnp-org:service:VMC-3Axis:1');

adapter.on('advertise-alive', (headers) => {
  console.log(headers);
});

adapter.on('advertise-bye', (headers) => {
  console.log(headers);
});

adapter.start();

process.on('exit', () => {
  adapter.stop();
});

module.exports = {
  machineDataGenerator,
  fileServer,
};
