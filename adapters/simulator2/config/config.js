const ip = require('ip').address()
const env = process.env

module.exports = {
  uuid: '484df8f6-bc5c-11e7-80de-28cfe91a82ef',
  address: ip,
  machinePort: 7878,
  filePort: 3000,
  maxDelay: 3000,
  urn: 'Simulator2',
  manufacturer: 'SystemInsights',
  modelName: 'Simulator2',
  serialNumber: '5678910',
  inputFile: './adapters/simulator2/public/Mazak03.log',
  deviceFile: './adapters/simulator2/public/Mazak03.xml',
  
  app: {
    name: 'Simulator_2',
    version: '0.1'
  },
	
  logging: {
    logLevel: env.MTC_LOG_LEVEL || 'warn',
    logDir: env.MTC_LOG_DIR
  }	
  
}
