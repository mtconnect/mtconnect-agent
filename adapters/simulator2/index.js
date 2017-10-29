global.config = require('./config/config')

const log = require('../src/logger')
const adapter =require('../src/adapter')
const device = require('../src/device')
const fileServer = require('../src/fileserver')

adapter.start()
device.listen(config.machinePort, config.address, () => log.info(`Running device on ${config.machinePort}`))
fileServer.listen(config.filePort, config.address, () => log.info(`File server started on ${config.filePort}`))
