const ip = require('ip').address()
const env = process.env

module.exports = {
  uuid: '3f707e77-7b44-55a0-9aba-2a671d5e7089',
  address: ip,
  machinePort: 7878,
  filePort: 3000,
  maxDelay: 3000,
  urn: 'Simulator2',
  manufacturer: 'SystemInsights',
  modelName: 'Simulator2',
  serialNumber: '5678910',
  inputFile: './adapters/simulator2/public/VMC-3Axis-Log.txt',
  deviceFile: './adapters/simulator2/public/Device.xml',
  
  
	app: {
	  name: 'Simulator_2',
    version: '0.1'
	},
	
  logging: {
    logLevel: env.MTC_LOG_LEVEL || 'warn',
	  logDir: env.MTC_LOG_DIR
  }	
  
}