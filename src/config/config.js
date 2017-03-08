const env = process.env;
const R = require('ramda');

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
  },
  'VMC-4Axis': {
    IgnoreTimestamps: false,
    ConversionRequired: true,
    AutoAvailable: false,
    RealTime: false,
    RelativeTime: false,
    FilterDuplicates: false,
    UpcaseDataItemValue: true,
  },
};

function setConfiguration(device, parameter, value) {
  if (!(device && device.id && device.$.name)) return;
  adapters[device.$.name][parameter] = value;
  return adapters[device.$.name][parameter];
}

function getConfiguredVal(devName, parName) {
  const keys = R.keys(adapters);
  let device;
  let parameter;
  R.find((k) => {
    if (k === devName) {
      device = k;
    }
    return device;
  }, keys);
  if (device !== undefined) {
    const subKeys = R.keys(adapters[device]);
    R.find((k) => {
      if (k === parName) {
        parameter = k;
      }
      return parameter;
    }, subKeys);
  } else {
    console.log(`The requested device name ${devName} is not present in list of adapters`);
    return undefined;
  }
  if (parameter !== undefined) {
    return adapters[device][parameter];
  }
  console.log(`The requested parameter name ${devName} is not present in device ${device}`);
  return undefined;
}

module.exports = {
  app: {
    name: 'svc-agent-reader',
    version: env.VI_VERSION || console.log('WARN: env.VI_VERSION not set unknown'),
    simulator: {
      uuid: '000',
      machinePort: 7879,
      filePort: 8080,
      maxDelay: 3000,
      urn: 'VMC-3Axis',
      inputFile: './public/vmc_10di.txt',
    },
    agent: {
      allowPut: true,
      AllowPutFrom: ['192.168.100.16', '192.168.1.37', 'localhost', '127.0.0.1'],
      deviceSearchInterval: 10000,
      agentPort: 7000,
      bufferSize: env.VI_BUFFER_SIZE || 32768,
      checkPointIndex: 1000,
      path: '/VMC-3Axis.xml',
      urnSearch: 'VMC-*',
    },
  },
  logging: {
    logLevel: env.VI_LOG_LEVEL || 'warn',
    logDir: env.VI_LOG_DIR,
  },
  getConfiguredVal,
  setConfiguration,
};
