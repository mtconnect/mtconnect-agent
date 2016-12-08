const env = process.env;

// configuration parameter

const mIgnoreTimestamps = false;
const mConversionRequired = false;
const mAutoAvailable = false;
const mRealTime = false;
const mRelativeTime = false;
const mFilterDuplicates = false;

function getConfiguredVal(x) {
  if (x === 'mIgnoreTimestamps') {
    return mIgnoreTimestamps;
  } else if (x === 'mConversionRequired') {
    return mConversionRequired;
  } else if (x === 'mAutoAvailable') {
    return mAutoAvailable;
  } else if (x === 'mRelativeTime') {
    return mRelativeTime;
  } else if (x === 'mRealTime') {
    return mRealTime;
  } else if (x === 'mFilterDuplicates') {
    return mFilterDuplicates;
  }
  return 'Non Valid request'
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
      AllowPutFrom: ['192.168.100.16', '192.168.1.37', 'localhost'],
      deviceSearchInterval: 10000,
      agentPort: 7000,
      bufferSize: env.VI_BUFFER_SIZE || 10,
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
};
