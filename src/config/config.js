const env = process.env

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
      urnSearch: '*'
    }
  },
  logging: {
    logLevel: env.MTC_LOG_LEVEL || 'debug',
    logDir: env.MTC_LOG_DIR
  }
}
