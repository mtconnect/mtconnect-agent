const log = require('./config/logger');
const init = require('./init');
const Client = require('node-ssdp').Client // Control Point

var agent = new Client();

agent.on('notify', function (response) {
    console.log('NOTIFY response:')
    console.log(response);
});

agent.on('response', function inResponse(headers, code, rinfo) {
    // TODO: Handle CACHE-CONTROL
    console.log('Got a response to an m-search:\n%d\n%s\n%s', code, JSON.stringify(headers, null, '  '), JSON.stringify(rinfo, null, '  '));
});


// Or maybe if you want to scour for everything
setInterval(function() {
    agent.search('urn:schemas-upnp-org:service:MediaServer:1');
  // agent.search('ssdp:all')
}, 10000)
