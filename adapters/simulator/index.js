const log = require('../../src/config/logger')
const ip = require('ip').address()
const adapter = require('./adapter')
const device = require('./device')
const fileServer = require('./fileserver')
const { filePort, machinePort } = require('./config')


adapter.start()
device.listen(machinePort, ip, () => log.info(`Running device on ${machinePort}`))
fileServer.listen(filePort, ip, () => log.info(`File server started on ${filePort}`))
