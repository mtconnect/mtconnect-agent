const log  = require("./config/logger");
const init = require("./init");

/*
 *  SSDP
 */

const ssdp = require("node-ssdp").Server;

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
const node_static = require("node-static");

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

const net   = require("net");

const MACHINE_PORT = 8081;

function* machineDataGenerator() {
    yield '2|execution|INTERRUPTED\r\n';
    yield '2|tool_id|1\r\n';
    yield '2|execution|ACTIVE\r\n';
}

var machine = net.createServer();

var machineData = machineDataGenerator();

machine.on('connection', (socket) => {

    data = machineData.next().value;
    if (data) { socket.write(data) };

});

machine.listen(MACHINE_PORT, "localhost");

log.info("Starting machine TCP server on port %d", MACHINE_PORT);
