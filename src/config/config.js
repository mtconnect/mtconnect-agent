const env = process.env
const R = require('ramda')
const HashMap = require('hashmap')


//instances

const hashAdapters = new HashMap()

const obj1 = {
  IgnoreTimestamps: false,
  ConversionRequired: true,
  AutoAvailable: false,
  RealTime: false,
  RelativeTime: false,
  FilterDuplicates: true,
  UpcaseDataItemValue: true,
  PreserveUuid: true
}

const obj2 = {
  IgnoreTimestamps: false,
  ConversionRequired: true,
  AutoAvailable: false,
  RealTime: false,
  RelativeTime: false,
  FilterDuplicates: false,
  UpcaseDataItemValue: true,
  PreserveUuid: true
}

hashAdapters.set('VMC-3Axis', obj1)
hashAdapters.set('VMC-4Axis', obj2)

// configuration parameter for each adapter

const adapters = {
  'VMC-3Axis': {
    IgnoreTimestamps: false,
    ConversionRequired: true,
    AutoAvailable: false,
    RealTime: false,
    RelativeTime: false,
    FilterDuplicates: true,
    UpcaseDataItemValue: true,
    PreserveUuid: true
  },
  'VMC-4Axis': {
    IgnoreTimestamps: false,
    ConversionRequired: true,
    AutoAvailable: false,
    RealTime: false,
    RelativeTime: false,
    FilterDuplicates: false,
    UpcaseDataItemValue: true,
    PreserveUuid: true
  }
}

function setConfiguration(device, parameter, value){
  if(!(device && device.$.name && device.$.id)) return
  
  if(!hashAdapters.has(device.$.name)){
    console.log(`The requested device name ${device.$.name} is not present in list of adapters`)
    return
  }
  
  const adapter = hashAdapters.get(device.$.name)
  
  adapter[parameter] = value
  return adapter[parameter]
}
// function setConfiguration (device, parameter, value) {
//   if (!(device && device.$.id && device.$.name)) return
//   adapters[device.$.name][parameter] = value
//   return adapters[device.$.name][parameter]
// }

function getConfiguredVal(devName, parName){
  const adapter = hashAdapters.get(devName)
  if(!adapter){
    console.log(`The requested device name ${devName} is not present in list of adapters`)
    return
  }

  if(adapter[parName] === undefined){
    console.log(`The requested parameter name ${parName} is not present in device ${devName}`)
    return undefined
  }

  return adapter[parName]
}

module.exports = {
  app: {
    name: 'svc-agent-reader',
    version: env.MTC_VERSION || console.log('WARN: env.MTC_VERSION not set unknown'),
    agent: {
      allowPut: true,
      AllowPutFrom: ['192.168.100.16', '192.168.1.37', 'localhost', '127.0.0.1'],
      deviceSearchInterval: 10000,
      agentPort: 7000,
      bufferSize: env.MTC_BUFFER_SIZE || 100,
      checkPointIndex: 1000,
      path: '/VMC-3Axis.xml',
      urnSearch: 'VMC-*'
    }
  },
  logging: {
    logLevel: env.MTC_LOG_LEVEL || 'warn',
    logDir: env.MTC_LOG_DIR
  },
  getConfiguredVal,
  setConfiguration,
  hashAdapters
}
