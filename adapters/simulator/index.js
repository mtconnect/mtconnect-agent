
const config = require('../src/config.js')
const log = config.logger
const device = require('../src/device')
const fileServer = require('../src/fileserver')
const adapter = require('../src/adapter')

adapter.start();

device(config.get('app:inputFile')).listen(config.get('app:machinePort'), '0.0.0.0',
  () => log.info(`SHDR stared on 0.0.0.0:${config.get('app:filePort')}`))

fileServer.listen(config.get('app:filePort'), '0.0.0.0',
  () => log.info(`File server started on 0.0.0.0:${config.get('app:filePort')}`))
