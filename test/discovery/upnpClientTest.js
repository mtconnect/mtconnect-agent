
const mockery = require('mockery');
mockery.enable({
  warnOnReplace: false,
  warnOnUnregistered: false,
  useCleanCache: true,
});

const MockSSDP = require('../helpers/mock-ssdp');
const { Client } = MockSSDP;

const expect = require('unexpected').clone()
  .use(require('unexpected-stream'))
  .use(require('unexpected-dom'));
const sinon = require('sinon');

describe('upnp client test', () => {
  beforeEach('Fake SSDP', () => {
    Client.fail = false;
    Client.response = '';
    mockery.registerMock('node-ssdp', MockSSDP);
    this.upnpFinder = require('../../src/discovery/upnp');
  });
  
  afterEach('Fake SSDP', () => {
    mockery.deregisterAll();
  });
  
  it('should parse ssdp header and get location', (done) => {
    Client.response = {
      LOCATION: 'http://127.0.0.1:8080/',
      USN: 'uuid:43444e50-a578-11e7-a3dd-28cfe91a82ef::urn:mtconnect-org:service:*',
    };
    const finder = new this.upnpFinder({ query: '*', frequency: 100 });
    finder.on('device', ({ hostname, port, uuid }) => {
      expect(hostname, 'to equal', '127.0.0.1');
      expect(port, 'to equal', '8080');
      expect(uuid, 'to equal', '43444e50-a578-11e7-a3dd-28cfe91a82ef');
      finder.stop();
      done();
    });
    finder.start();
  });
  it('should request description from adapter');
  it('should parse description XML and get URL Base');
  it('should hand back the device XML to the agent to add to the set of devices');
});