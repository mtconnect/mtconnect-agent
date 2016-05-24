const log = require("./config/logger");
const init = require("./init");

var ipAddress = init.getIP();

log.warn(ipAddress)
