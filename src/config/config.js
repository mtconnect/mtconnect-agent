const env = process.env;

module.exports = {
  app: {
    name: 'svc-agent-reader',
    version: env.VI_VERSION || console.log('WARN: env.VI_VERSION not set unknown'),
  },
  logging: {
    logLevel: env.VI_LOG_LEVEL || 'warn',
    logDir: env.VI_LOG_DIR,
  },
};
