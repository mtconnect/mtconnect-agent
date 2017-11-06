const ip = require('ip').address()
const env = process.env

module.exports = {
  uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef',
  address: ip,
  machinePort: 7879,
  filePort: 8080,
  maxDelay: 3000,
  urn: 'Simulator1',
  manufacturer: 'SystemInsights',
  modelName: 'Simulator',
  serialNumber: '123456',
  inputFile: './adapters/simulator/public/Mazak01.log',
  deviceFile: './adapters/simulator/public/Mazak01.xml',
	
  app: {
    name: 'Simulator_1',
    version: '0.1'
  },
	
  logging: {
    logLevel: env.MTC_LOG_LEVEL || 'debug',
    logDir: env.MTC_LOG_DIR
  }	
}
