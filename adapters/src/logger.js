const bunyan = require('bunyan')

module.exports = bunyan.createLogger({
  name: config.app.name,
  version: config.app.version,
  logDir: config.logging.logDir,
  level: config.logging.logLevel
})
