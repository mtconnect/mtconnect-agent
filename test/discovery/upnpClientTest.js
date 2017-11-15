
const mockery = require('mockery');
mockery.enable({
  warnOnReplace: false,
  warnOnUnregistered: false,
  useCleanCache: true,
});

const fs = require('fs');
const nock = require('nock');
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
    this.UpnpFinder = require('../../src/discovery/upnp');
  });
  
  afterEach('Fake SSDP', () => {
    mockery.deregisterAll();
  });
  
  describe('with fake ssdp and discovery', () => {
    beforeEach('Fake SSDP', () => {
      this.promise = new Promise((resolve, reject) => {
        this.stub = sinon.stub(this.UpnpFinder.prototype, 'device')
          .callsFake((data) => {
            resolve(data);
          });
      });
      this.finder = new this.UpnpFinder({ query: '*', frequency: 1 });
    });
  
    afterEach('Fake SSDP', () => {
      this.stub.restore();
    });

    it('should parse ssdp header and get location', (done) => {
      Client.response = {
        LOCATION: 'http://127.0.0.1:8080/',
        USN: 'uuid:43444e50-a578-11e7-a3dd-28cfe91a82ef::urn:mtconnect-org:service:*',
      };
    
      this.finder.start();
      this.promise.then(() => {
        this.finder.stop();
        expect(this.stub.calledWith(Client.response), 'to be true');
        done();
      });
    });
  });
  
  describe('with description', () => {
    it('should get a URL from a description', (done) => {
      this.descirption = `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0" configId="123">
  <specVersion>
    <major>1</major>
    <minor>0</minor>
  </specVersion>
  <URLBase>http://127.0.0.1:8080/</URLBase>
  <device>
    <deviceType>urn:mtconnect.org:device:MTConnectDevices:1</deviceType>
    <friendlyName>Friendly Name</friendlyName>
    <manufacturer>Sample Manufacturer</manufacturer>
    <modelName>Dummy Model</modelName>
    <serialNumber>1234567</serialNumber>
    <UDN>uuid:43444e50-a578-11e7-a3dd-28cfe91a82ef</UDN>
    <iconList/>
    <serviceList/>
  </device>
</root>`;

      this.UpnpFinder.parseDescription(this.descirption)
        .then((u) => {
          expect(u, 'to equal', 'http://127.0.0.1:8080/');
          done();
        })
        .catch((err) => {
          expect(err, 'to be false');
          done();
        });
    });
  
    it('should reject a bod descriptor', (done) => {
      this.descirption = `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0" configId="123">
  <specVersion>
    <major>1</major>
    <minor>0</minor>
  </specVersion>
  <device>
    <deviceType>urn:mtconnect.org:device:MTConnectDevices:1</deviceType>
    <friendlyName>Friendly Name</friendlyName>
    <manufacturer>Sample Manufacturer</manufacturer>
    <modelName>Dummy Model</modelName>
    <serialNumber>1234567</serialNumber>
    <UDN>uuid:43444e50-a578-11e7-a3dd-28cfe91a82ef</UDN>
    <iconList/>
    <serviceList/>
  </device>
</root>`;
  
      this.UpnpFinder.parseDescription(this.descirption)
        .then((u) => {
          expect(u, 'to be false');
          done();
        })
        .catch((err) => {
          expect(err.message, 'to equal', 'Cannot find URLBase');
          done();
        });
    });
  });
  
  
  describe('with a device file', () => {
    beforeEach('setup mock http', () => {
      this.finder = new this.UpnpFinder({ query: '*', frequency: 1 });
    });
    
    it('should resolve the data from the device and emit the device object', (done) => {
      const devices = fs.readFileSync('./test/support/min_config.xml', 'utf8');
      this.finder.on('device', ({ device, data }) => {
        expect(device, 'to equal', devices);
        expect(data, 'to equal', 'shdr://127.0.0.1:7878/');
        done();
      });
      this.finder.emitDeviceXml(devices)
        .then((xml) => {
          expect(xml, 'to equal', devices);
        })
        .catch((err) => {
          expect(err.message, 'to be false');
        });
    });
  });
});

/* nock('http://127.0.0.1:8080')
  .get('/')
  .delayBody(100)
  .reply(200, response);
  */
