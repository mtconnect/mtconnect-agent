const log = require('./config/logger'); // TODO: Use module import/export
// const init = require('./init');
const ip = require('ip');

/*
 *  Machine data
 */

const fs = require('fs');
const net = require('net');
const readlines = require('gen-readlines');
const MACHINE_PORT = 8081;
const SERVE_FILE_PORT = 8080;
const nodeStatic = require('node-static');

const machine = net.createServer();
const SSDP = require('node-ssdp').Server;
const file = new nodeStatic.Server('./public');
const adapter = new SSDP({ location: `${ip.address()}:${MACHINE_PORT}` });

// TODO: Fix description and params in functions
function* machineDataGenerator() {
  const fd = fs.openSync('./public/simple_scenario_1.txt', 'r');
  const stats = fs.fstatSync(fd);

  for (var line of readlines(fd, stats.size)) { // Change to use map
    yield line.toString(); // TODO: String
  }

  fs.closeSync(fd);
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

require('http').createServer((request, response) => {
  request.addListener('end', () => {
    /*
     *  Serve files!
     */
    file.serve(request, response);
  }).resume();
}).listen(SERVE_FILE_PORT);

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

