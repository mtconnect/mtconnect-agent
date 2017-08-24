const log = require('../config/logger')
const ip = require('ip').address()
const config = require('../config/config')
const adapter = require('./adapter')
const adapter2 =require('./adapter2')
const device = require('./device')
const device2 = require('./device2')
const fileServer = require('./fileserver')
const fileserver2 = require('./fileserver2')
const { filePort, machinePort } = config.app.simulator


adapter2.start()
device2.listen('7878', ip, () => log.info('Running device on 7878'))
fileserver2.listen('3000', ip, () => log.info('File server started on 3000'))
adapter.start()
device.listen(machinePort, ip, () => log.info(`Running device on ${machinePort}`))
fileServer.listen(filePort, ip, () => log.info(`File server started on ${filePort}`))
