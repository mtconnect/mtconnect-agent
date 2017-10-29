global.config = require('./config/config')

const log = require('../src/logger')
const ip = require('ip').address()
const adapter =require('../src/adapter')
const device = require('../src/device')
const fileServer = require('../src/fileserver')

adapter.start()
device.listen(config.machinePort, ip, () => log.info(`Running device on ${config.machinePort}`))
fileServer.listen(config.filePort, ip, () => log.info(`File server started on ${config.filePort}`))
