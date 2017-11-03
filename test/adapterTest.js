const readline = require('readline');
const http = require('http');
const assert = require('assert');
const sinon = require('sinon')
const request = require('co-request');
const parse = require('xml-parser');
const fs = require('fs');
const ip = require('ip').address();
const { Client } = require('node-ssdp');
const R = require('ramda')
const uuidv5 = require('uuid/v5')
const bigInt = require('big-integer')

// Imports - Internal
global.config = require('../adapters/simulator/config/config');
const adapter = require('../adapters/src/adapter');
const device = require('../adapters/src/device');
const fileServer = require('../adapters/src/fileserver');
const configAgent = require('../src/config/config')
const configSimulator = require('../adapters/simulator/config/config')
const configSimulator2 = require('../adapters/simulator2/config/config')
const dataStorage = require('../src/dataStorage')
const lokijs = require('../src/lokijs')
const agent = require('../src/agent')
const common = require('../src/common')
const xmlToJSON = require('../src/xmlToJSON')
const { genId } = require('../src/genIds')
const description = require('../adapters/utils/description')

//constants
const cbPtr = dataStorage.circularBuffer
const schemaPtr = lokijs.getSchemaDB()
const { filePort, machinePort, inputFile } = configSimulator;
const { path, urnSearch } = configAgent.app.agent;
const client = new Client();

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

const isLine = (item) => item.name === 'Line'

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
})

describe('test Adapter', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const url = `http://${ip}:7000/sample`
  const name = 'Line'
  const content = 'UNAVAILABLE'
  const str = 'TIME|line|204'
  const str2 = 'TIME|alarm|code|nativeCode|severity|state|description' 
  let stub

  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./adapters/simulator/public/Mazak01.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    agent.start()
  })

  after(() => {
    agent.stop()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('should return UNAVAILABLE for type LINE', function *(done){
    const { body } = yield request(url)
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0].children[6].children[1].children
    const line = R.filter(isLine, child)
    
    assert(line.length === 1)
    assert(line[0].name === name)
    assert(line[0].content === content)
    done()
  })

  it('should add new dataItem type LINE with content 204', function *(done){
    common.parsing(str, uuid)
    const newContent = '204' 

    const { body } = yield request(url)
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0].children[6].children[1].children 
    const line = R.filter(isLine, child)
    const alarm = R.filter((item) => item.name === 'Alarm', child)

    assert(line.length === 2)
    assert(line[0].name === name)
    assert(line[0].content === content)
    assert(line[1].name === name)
    assert(line[1].content === newContent)
    assert(alarm.length === 1)
    assert(alarm[0].name === 'Alarm')
    assert(alarm[0].content === content)
    done()
  })
  it('should add new dataItem for type ALARM', function *(done){
    common.parsing(str2, uuid)

    const { body } = yield request(url)
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0].children[6].children[1].children
    const line = R.filter(isLine, child)
    const alarm = R.filter((item) => item.name === 'Alarm', child)

    assert(line.length === 2)
    assert(line[0].content === content)
    assert(line[1].content === '204')
    assert(alarm.length === 2)
    assert(alarm[0].content === content)
    assert(alarm[1].content === 'description')
    assert(alarm[1].attributes.code === 'CODE')
    assert(alarm[1].attributes.nativeCode === 'nativeCode')
    assert(alarm[1].attributes.severity === 'severity')
    assert(alarm[1].attributes.state === 'state')
    done()
  })
})

describe('description()', () => {
  let xml, xml2
  it('returns xml description for simulator', () => {
    xml = description(configSimulator)
    assert(xml)
  })
  it('return xml description for simulator2', () => {
    xml2 = description(configSimulator2)
    assert(xml2)
  })
  it('makes sure descriptions are not the same for different simulators', () => {
    assert(xml !== xml2)
  })
})
