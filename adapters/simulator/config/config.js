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
  inputFile: './adapters/simulator/public/vmc_10di.txt',
  deviceFile: './adapters/simulator/public/Device.xml',
  
	
	app: {
	  name: 'Simulator_1',
    version: '0.1'
	},
	
  logging: {
    logLevel: env.MTC_LOG_LEVEL || 'warn',
	  logDir: env.MTC_LOG_DIR
  }	
}