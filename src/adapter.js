const log = require("./config/logger");
const init = require("./init");
const ssdp = require("node-ssdp").Server

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
