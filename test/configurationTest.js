const expect = require('unexpected').clone();
let config;

describe('configuration', () => {
  before(() => {
    const nconf = require('nconf');
  
    nconf.remove('simulator1');
    nconf.remove('adapter_default');
    process.env.node_env = 'test';
    config = require('../src/configuration');
  });
  
  
  describe('configuration', () => {
    it('should have configured to match the simulator1 configuration', () => {
      expect(config.get('app:name'), 'to equal', 'mtconnect-agent');
      expect(config.get('app:agent:agentPort'), 'to equal', 5000);
      expect(config.get('app:agent:bufferSize'), 'to equal', 131072);
      expect(config.get('app:agent:assetBufferSize'), 'to equal', 1024);
    });
  });
});
