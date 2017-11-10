const rl = require('readline')
const request = require('co-request')
const fs = require('fs')
const { Client } = require('node-ssdp')
const R = require('ramda')
const net = require('net')

const sinon = require('sinon')
const jsdom = require('jsdom')
const { JSDOM } = jsdom

// SSDP Client – Refactor to discovery
const client = new Client()

const expect = require('unexpected').clone()
  .use(require('unexpected-stream'))
  .use(require('unexpected-dom'))

// Default to using simulator 1 for these tests
process.env.name = 'simulator1'
process.env.app__address = '127.0.0.1'

// Imports - Internal
const config = require('../../adapters/src/config')
const adapter = require('../../adapters/src/adapter')
const device = require('../../adapters/src/device')
const fileServer = require('../../adapters/src/fileserver')

function * getLine(stream) {
  stream.resume()
  
  return new Promise((resolve, reject) => {
    stream.on('line', (line) => {
      resolve(line)
      stream.pause()
      stream.removeAllListeners()
    })
  
    stream.on('end', (err) => {
      resolve(null)
      stream.removeAllListeners()
    })
  
    stream.on('error', (err) => {
      reject(err)
      stream.removeAllListeners()
    })
  })
}

describe('simulator', () => {
  describe('configuration', () => {
    it('should have configured to match the simulator1 configuration', () => {
      expect(config.get('app:name'), 'to equal', 'Simulator_1')
      expect(config.get('app:machinePort'), 'to equal', 7878)
      expect(config.get('app:filePort'), 'to equal', 8080)
      expect(config.get('app:address'), 'to equal', '127.0.0.1')
    })
  })
  
  describe('discovery using UPnP', () => {
    beforeEach('start adapter', () => adapter.start())
    afterEach('start adapter', () => adapter.stop())
  
    it('should be found using UPnP', function * (done) {
      this.timeout(12000)
      
      const lookup = `urn:schemas-mtconnect-org:service:*`
      client.on('response', (headers) => {
        const {ST, LOCATION, USN} = headers
        expect(ST, 'to equal', lookup)
        expect(LOCATION, 'to equal', `http://${config.get('app:address')}:${config.get('app:filePort')}/`)
        expect(USN, 'to equal', `uuid:${config.get('app:uuid')}::urn:schemas-mtconnect-org:service:*`)
        client.stop()
        done()
      })
      client.search(lookup)
    })
  })
  
  describe('fileServer', () => {
    let listener
  
    beforeEach('setup file server', () => {
      listener = fileServer.listen(config.get('app:filePort'), '127.0.0.1')
    })
  
    afterEach('close file server', () => listener.close())
  
    describe('UPnP description', () => {
      it('should provide an XML response', function* xml() {
        const res = yield request(`http://127.0.0.1:${config.get('app:filePort')}`)
        expect(res.statusCode, 'to equal', 200)
        expect(res.headers['content-type'], 'to equal', 'application/xml')
      })
    
      it('should have a base URL set to the current address', function* xml() {
        const res = yield request(`http://127.0.0.1:${config.get('app:filePort')}`)
        expect(res.statusCode, 'to equal', 200)
        let dom = new JSDOM(res.body, {contentType: 'text/xml'}).window.document
        const root = dom.children[0]
        expect(root.localName, 'to equal', 'root')
        expect(root, 'to have child', 'URLBase')
        expect(root, 'queried for', 'URLBase', 'to have items satisfying',
          'to have text', `http://127.0.0.1:${config.get('app:filePort')}`)
        expect(root, 'queried for', 'UDN', 'to have items satisfying',
          'to have text', `uuid:${config.get('app:uuid')}`)
      })
    })
  
    describe('MTConnect probe', () => {
      it('should provide an XML response', function* xml() {
        const res = yield request(`http://127.0.0.1:${config.get('app:filePort')}/probe`)
        expect(res.statusCode, 'to equal', 200)
        expect(res.headers['content-type'], 'to equal', 'application/xml')
      })
    
      it('should have an MTConnect devices document', function* xml() {
        const res = yield request(`http://127.0.0.1:${config.get('app:filePort')}/probe`)
        expect(res.statusCode, 'to equal', 200)
      
        let dom = new JSDOM(res.body, {contentType: 'text/xml'}).window.document
        const root = dom.children[0]
        expect(root.localName, 'to equal', 'MTConnectDevices')
      })
    
      it('should have return a device named Mazak01', function* xml() {
        const res = yield request(`http://127.0.0.1:${config.get('app:filePort')}/probe`)
        expect(res.statusCode, 'to equal', 200)
      
        let dom = new JSDOM(res.body, {contentType: 'text/xml'}).window.document
        const root = dom.children[0]
        expect(root, 'queried for', 'Device', 'to have items satisfying',
          'to have attributes', {name: 'Mazak01', uuid: config.get('app:uuid')})
      })
    
      it('should add a data tag to the device description', function* xml() {
        const res = yield request(`http://127.0.0.1:${config.get('app:filePort')}/probe`)
        expect(res.statusCode, 'to equal', 200)
      
        let dom = new JSDOM(res.body, {contentType: 'text/xml'}).window.document
        const root = dom.children[0]
      
        expect(root, 'queried for', 'Description > Data', 'to have items satisfying',
          'to have attributes',
          {href: `shdr://${config.get('app:address')}:${config.get('app:machinePort')}`})
      })
    })
  })
  
  describe('SHDR Stream', () => {
    let listener;
    
    beforeEach('Start server', () => {
      listener = device('./test/support/mazak01.log')
        .listen(config.get('app:machinePort'), '127.0.0.1')
    })
    
    afterEach('Stop server', () => listener.close())
    
    it('should stream data when opened', function * data(done) {
      this.timeout(4000)
      
      const socket = net.createConnection(config.get('app:machinePort'), '127.0.0.1')
      const reader = rl.createInterface(socket)
      reader.pause()
  
      socket.setNoDelay(true)
  
      expect(yield getLine(reader), 'to contain', 'Tool_number|16')
      expect(yield getLine(reader), 'to contain', 'Tool_suffix|C')
      expect(yield getLine(reader), 'to contain', 'Bdeg|90')
      
      done()
      
      socket.end()
    })
    
    it('should respond to a PING with a PONG', function * data(done) {
      const socket = net.createConnection(config.get('app:machinePort'), '127.0.0.1')
      socket.setNoDelay(true)
      socket.write('* PING\n')

      const reader = rl.createInterface(socket)
      reader.pause()
      
      expect(yield getLine(reader), 'to equal', '* PONG 10000')
  
      done()
  
      socket.end()
    })
  })
})

/*
function getLine() {
  return new Promise((success, fail) => {
    const stm = fs.createReadStream(inputFile);
    const rl = readline.createInterface({
      input: stm,
    });

    rl.on('line', function onLine(line) {
      rl.removeListener('line', onLine);
      stm.close();
      rl.close();
      success(line);
    });
    rl.on('error', (err) => {
      rl.close();
      fail(err);
    });
  });
}

const isLine = (item) => item.name === 'Line';

describe('simulator', () => {
  let deviceT;
  let filesT;
  let lineT;

  before(function *setup() {
    yield adapter.start();
    lineT = yield getLine();
    yield new Promise((success) => (deviceT = device.listen(machinePort, ip, success)));
    yield new Promise((success) => (filesT = fileServer.listen(filePort, ip, success)));
  });

  after(() => {
    deviceT.close();
    filesT.close();
    adapter.stop();
  });

  describe('device', () => {
    it('streams data', (done) => {
      const req = http.get(`http://${ip}:${machinePort}`, (res) => {
        assert.equal(res.headers['content-type'], 'text/event-stream; charset=utf-8');
        assert.equal(res.statusCode, 200);
        res.once('data', (line) => {
          assert.equal(lineT, line.toString());
          req.end();
          done();
        });
      }).on('error', done);
    });
  });

  describe('fileServer', () => {
    it('serves xml def', function *xml() {
      const res = yield request(`http://${ip}:${filePort}`);
      assert(res.headers['content-type'] === 'application/xml');
    });
  });

  describe('adapter', () => {
    it('can be found via UPnP', (done) => {
      const lookup = `urn:schemas-mtconnect-org:service:${urnSearch}`;
      client.on('response', (headers) => {
        const { ST, LOCATION } = headers;
        assert(ST === lookup);
        assert(LOCATION === `${ip}:${filePort}`);
        client.stop();
        done();
      });
      client.search(lookup);
    });
  });
});

describe('test Adapter', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef';
  const url = `http://${ip}:7000/sample`;
  const name = 'Line';
  const content = 'UNAVAILABLE';
  const str = 'TIME|line|204';
  const str2 = 'TIME|alarm|code|nativeCode|severity|state|description';
  let stub;

  before(() => {
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    dataStorage.hashAdapters.clear();
    const xml = fs.readFileSync('./adapters/simulator/public/Mazak01.xml', 'utf8');
    lokijs.updateSchemaCollection(xml);
    stub = sinon.stub(common, 'getAllDeviceUuids');
    stub.returns([uuid]);
    agent.start()
  });

  after(() => {
    agent.stop();
    schemaPtr.clear();
    cbPtr.fill(null).empty();
    dataStorage.hashCurrent.clear();
    dataStorage.hashLast.clear();
    dataStorage.hashAdapters.clear();
    stub.restore()
  });

  it('should return UNAVAILABLE for type LINE', function *(done){
    const { body } = yield request(url);
    const obj = parse(body);
    const { root } = obj;
    const child = root.children[1].children[0].children[6].children[1].children;
    const line = R.filter(isLine, child);
    
    assert(line.length === 1);
    assert(line[0].name === name);
    assert(line[0].content === content);
    done()
  });

  it('should add new dataItem type LINE with content 204', function *(done){
    common.parsing(str, uuid);
    const newContent = '204';

    const { body } = yield request(url);
    const obj = parse(body);
    const { root } = obj;
    const child = root.children[1].children[0].children[6].children[1].children;
    const line = R.filter(isLine, child);
    const alarm = R.filter((item) => item.name === 'Alarm', child);

    assert(line.length === 2);
    assert(line[0].name === name);
    assert(line[0].content === content);
    assert(line[1].name === name);
    assert(line[1].content === newContent);
    assert(alarm.length === 1);
    assert(alarm[0].name === 'Alarm');
    assert(alarm[0].content === content);
    done()
  });
  it('should add new dataItem for type ALARM', function *(done){
    common.parsing(str2, uuid);

    const { body } = yield request(url);
    const obj = parse(body);
    const { root } = obj;
    const child = root.children[1].children[0].children[6].children[1].children;
    const line = R.filter(isLine, child);
    const alarm = R.filter((item) => item.name === 'Alarm', child);

    assert(line.length === 2);
    assert(line[0].content === content);
    assert(line[1].content === '204');
    assert(alarm.length === 2);
    assert(alarm[0].content === content);
    assert(alarm[1].content === 'description');
    assert(alarm[1].attributes.code === 'CODE');
    assert(alarm[1].attributes.nativeCode === 'nativeCode');
    assert(alarm[1].attributes.severity === 'severity');
    assert(alarm[1].attributes.state === 'state');
    done()
  })
});

describe('description()', () => {
  let xml, xml2;
  it('returns xml description for simulator', () => {
    xml = description(configSimulator);
    assert(xml)
  });
  it('return xml description for simulator2', () => {
    xml2 = description(configSimulator2);
    assert(xml2)
  });
  it('makes sure descriptions are not the same for different simulators', () => {
    assert(xml !== xml2)
  })
});
*/
