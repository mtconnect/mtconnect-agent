const ip = require('ip');
const nconf = new require('nconf');
const bunyan = require('bunyan');

nconf.argv().env('__');
const name = nconf.get('name');
nconf.file(name, `./adapters/simulator/config/${name.toLowerCase()}.json`);
nconf.file('adapter_default', './adapters/simulator/config/default.json');
nconf.defaults({ app: { address: ip.address() } });

nconf.logger = bunyan.createLogger({
  name: nconf.get('app:name'),
  version: nconf.get('app:version'),
  logDir: nconf.get('logging:logDir'),
  level: nconf.get('logging:logLevel'),
});

module.exports = nconf;
