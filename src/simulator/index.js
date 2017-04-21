const log = require('../config/logger')
const ip = require('ip').address()
const config = require('../config/config')
const adapter = require('./adapter')
const device = require('./device')
const fileServer = require('./fileserver')
const { filePort, machinePort } = config.app.simulator

adapter.start()
device.listen(machinePort, ip, () => log.info(`Running device on ${machinePort}`))
fileServer.listen(filePort, ip, () => log.info(`File server started on ${filePort}`))
