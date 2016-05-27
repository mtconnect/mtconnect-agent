const log  = require('./config/logger');
const init = require('./init');

/*
 *  SSDP
 */

const ssdp = require('node-ssdp').Server;

var adapter = new ssdp();

// adapter.addUSN('upnp:rootdevice');
adapter.addUSN('urn:schemas-upnp-org:service:MediaServer:1');

adapter.on('advertise-alive', function (headers) {
    console.log(headers);
});

adapter.on('advertise-bye', function (headers) {
    console.log(headers);
});

adapter.start();

process.on('exit', function () {
    adapter.stop();
});

/*
 *  Serve Device definition file
 */

const SERVE_FILE_PORT = 8080;
const node_static = require('node-static');

var file = new node_static.Server("./public");

require('http').createServer(function (request, response) {
    request.addListener('end', function () {
        /*
         *  Serve files!
         */
        file.serve(request, response);
    }).resume();
}).listen(SERVE_FILE_PORT);

log.info("Starting HTTP web server on port %d", SERVE_FILE_PORT);

/*
 *  Machine data
 */

const fs        = require('fs');
const net       = require('net');
const readlines = require('gen-readlines');

const MACHINE_PORT = 8081;

function* machineDataGenerator() {
    var fd    = fs.openSync('./public/simple_scenario_1.txt', 'r');
    var stats = fs.fstatSync(fd);

    for (var line of readlines(fd, stats.size)) {
        yield line.toString();
    }
}

var machine = net.createServer();

machine.on('connection', (socket) => {
    var machineData = machineDataGenerator();

    var writeData = function (socket) {
        data = machineData.next().value;

        if (data) {
            setTimeout(function () {
                socket.write(data);
                writeData(socket);
            }, Math.floor(Math.random() * 3000)); // Simulate delay
        }
        else {
            socket.destroy();
        }
    };

    writeData(socket);
});

machine.listen(MACHINE_PORT, "localhost");

log.info("Starting machine TCP server on port %d", MACHINE_PORT);
