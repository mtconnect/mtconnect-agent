const ip = require('ip')
const nconf = require('nconf')
const bunyan = require('bunyan')

nconf.argv().env()
const name = nconf.get('name')
nconf.file(name, `./adapters/simulator/config/${name.toLowerCase()}.json`)
nconf.file('default', './adapters/simulator/config/default.json')
nconf.defaults({ app: { address: ip.address() } })

nconf.logger = bunyan.createLogger({
  name: nconf.get('app:name'),
  version: nconf.get('app:version'),
  logDir: nconf.get('app:logDir'),
  level: nconf.get('logging:logLevel'),
})

module.exports = nconf
