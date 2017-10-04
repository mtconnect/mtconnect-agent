const log = require('../config/logger')
const ip = require('ip').address()
const adapter2 =require('./adapter2')
const device2 = require('./device2')
const fileserver2 = require('./fileserver2')

adapter2.start()
device2.listen('7878', ip, () => log.info('Running device on 7878'))
fileserver2.listen('3000', ip, () => log.info('File server started on 3000'))