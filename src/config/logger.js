const config = require("./config");
const bunyan = require("bunyan");

module.exports = bunyan.createLogger({
    name:     config.app.name,
    version:  config.app.version,
    logDir:   config.logging.logDir,
    loglevel: config.logging.logLevel
});
