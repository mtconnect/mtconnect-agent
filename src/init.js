const log         = require("./config/logger");

const ip          = require("ip");
const my_local_ip = require("my-local-ip");

/*
 * Maybe IP address
 */
function getIP() {
    var localIP = my_local_ip();
    var validity = validIP(localIP) ? localIP : false;
    return validity;
}

/*
 * IP address -> Boolean
 */
function validIP(ipAddress) {
    if ((ip.mask(ipAddress, '127.0.0.1') == '127.0.0.1') ||     // Loopback
        (ip.cidrSubnet('169.254.0.0/16').contains(ipAddress)))  // AutoIP
        return false;
    else
        return true;
}

module.exports = { getIP };
