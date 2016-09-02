const env = process.env;

module.exports = {
  app: {
    name: 'svc-agent-reader',
    version: env.VI_VERSION || console.log('WARN: env.VI_VERSION not set unknown'),
    simulator: {
      uuid: 'gebangor_LB02_4b26e1',
      machinePort: 7879,
      maxDelay: 3000,
      inputFile: "./public/gebangor-one-minute.raw"
    },
    agent: {
      pingInterval: env.VI_PING_INTERVAL || 1000,
      deviceSearchInterval: 10000,
      agentPort: 7000,
      filePort: 8080,
      bufferSize: 10,
      checkPointIndex: 1000,
      path: '/ge_check.xml',
    },
  },
  logging: {
    logLevel: env.VI_LOG_LEVEL || 'warn',
    logDir: env.VI_LOG_DIR,
  },
};
