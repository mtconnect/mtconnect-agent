const ip = require('ip').address()
module.exports = {
  uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef',
  address: ip,
  machinePort: 7879,
  filePort: 8080,
  maxDelay: 3000,
  urn: 'VMC-3Axis',
  manufacturer: 'SystemInsights',
  modelName: 'Simulator',
  serialNumber: '123456',
  inputFile: './adapters/simulator/public/vmc_10di.txt'
}