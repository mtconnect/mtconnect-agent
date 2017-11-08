

const nconf = require('nconf');
const bunyan = require('bunyan');

function Config() {
  nconf.argv().env();
  const environment = nconf.get('NODE_ENV') || 'development';
  nconf.file(environment, `./config/${environment.toLowerCase()}.json`);
  nconf.file('default', './config/default.json');
}

Config.prototype.get = key => nconf.get(key);
Config.prototype.logger =  bunyan.createLogger({
  name: Config.get('app:name'),
  version: Config.get('app:version'),
  logDir: Config.get('app:logDir'),
  level: Config.get('logging:logLevel'),
});

module.exports = new Config();
