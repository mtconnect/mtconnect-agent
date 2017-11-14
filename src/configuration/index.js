const ip = require('ip');
const nconf = require('nconf');
const bunyan = require('bunyan');

nconf.argv().env({ lowerCase: true, separator: '__' });
const environment = nconf.get('node_env') || 'develop[ment';
nconf.file(environment, `./config/${environment.toLowerCase()}.json`);
nconf.file('default', './config/default.json');
nconf.defaults({ app: { address: ip.address() } });

nconf.logger = bunyan.createLogger({
  name: nconf.get('app:name'),
  version: nconf.get('app:version'),
  logDir: nconf.get('logging:logDir'),
  level: nconf.get('logging:logLevel'),
});

module.exports = nconf;
