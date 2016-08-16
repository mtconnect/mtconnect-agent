const env = process.env;

module.exports = {
  app: {
    name: 'svc-agent-reader',
    version: env.VI_VERSION || console.log('WARN: env.VI_VERSION not set unknown'),
    simulator: {
      uuid: '000',
      machinePort: 7879,
      maxDelay: 3000,
    },
    agent: {
      pingInterval: 10000,
      deviceSearchInterval: 3000,
      agentPort: 7000,
      filePort: 8080,
      bufferSize: 10,
      path:'/sampledevice.xml'
    },
  },
  logging: {
    logLevel: env.VI_LOG_LEVEL || 'warn',
    logDir: env.VI_LOG_DIR,
  },
};
