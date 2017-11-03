const ip = require('ip').address();
const assert = require('assert');
const fs = require('fs');
const sinon = require('sinon');
const request = require('co-request');
const parse = require('xml-parser');
const expect = require('expect.js');
const R = require('ramda');
const moment = require('moment')
const uuidv5 = require('uuid/v5')

// Imports - Internal
const lokijs = require('../src/lokijs')
const dataItemjs = require('../src/dataItem')
const dataStorage = require('../src/dataStorage')
const config = require('../src/config/config');
const simulatorConfig = require('../adapters/simulator/config/config')
const adapter = require('../adapters/src/adapter');
const device = require('../adapters/src/device');
const fileServer = require('../adapters/src/fileserver');
const { filePort, machinePort } = simulatorConfig;
const { start, stop } = require('../src/agent');
const common = require('../src/common');
const componentjs = require('../src/utils/component')
const devices = require('../src/store')

//constants
const schemaPtr = lokijs.getSchemaDB()
const cbPtr = dataStorage.circularBuffer
const bufferSize = config.app.agent.bufferSize
const rawData = lokijs.getRawDataDB()
const MTC_UUID = uuidv5('urn:mtconnect.org', '6ba7b812-9dad-11d1-80b4-00c04fd430c8')

describe('Agent', () => {
  let deviceT;
  let filesT;

  before(function *setup() {
    //adapter.start();
    yield start();
    yield new Promise((success) => (deviceT = device.listen(machinePort, ip, success)));
    yield new Promise((success) => (filesT = fileServer.listen(filePort, ip, success)));
  });


  after(() => {
    stop();
    deviceT.close();
    filesT.close();
  });

  it('returns error on request /bad/path/', function *(done){
    const path = '/bad/path/'
    const { body } = yield request(`http://${ip}:7000${path}`)
    
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0]
    const errorCode = child.attributes.errorCode
    const content = child.content

    expect(root.name).to.eql('MTConnectError')
    expect(errorCode).to.eql('UNSUPPORTED')
    expect(content).to.eql(`The following path is invalid: ${path}.`)
    done()
  })

  it('returns error on request /LinuxCNC/current/blah', function *(done) {
    const path = '/LinuxCNC/current/blah'
    const { body } = yield request(`http://${ip}:7000${path}`)
    
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0]
    const errorCode = child.attributes.errorCode
    const content = child.content

    expect(root.name).to.eql('MTConnectError')
    expect(errorCode).to.eql('UNSUPPORTED')
    expect(content).to.eql(`The following path is invalid: ${path}.`)
    done()
  })
});

describe('Bad device', ()=>{
  let deviceT
  let filesT
  before(function *() {
    yield start();
    yield new Promise((success) => (deviceT = device.listen(machinePort, ip, success)));
    yield new Promise((success) => (filesT = fileServer.listen(filePort, ip, success)));
  })

  after(()=> {
    stop()
    deviceT.close()
    filesT.close()
  })

  it('returns error if bad device', function *(done){
    const device = 'LinuxCN'
    const { body } = yield request(`http://${ip}:7000/${device}/probe`)
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0]
    const errorCode = child.attributes.errorCode
    const content = child.content

    expect(root.name).to.eql('MTConnectError')
    expect(errorCode).to.eql('NO_DEVICE')
    expect(content).to.eql(`Could not find the device ${device}.`)
    done()
  })
})

describe('test assetStorage', () => {
  const url = `http://${ip}:7000/assets`
  const maxAssets = 4
  let stub
  
  before(() => {
    schemaPtr.clear()
    dataStorage.assetBuffer.size = maxAssets
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.hashDataItemsByName.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['43444e50-a578-11e7-a3dd-28cfe91a82ef'])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.size = bufferSize
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.hashDataItemsByName.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })

  it('should return assetBufferSize and assetCount', (done) => {

    const assetCount = dataStorage.assetBuffer.length
    assert(dataStorage.assetBuffer.size === maxAssets)
    assert(assetCount === 0)
    done()
  })

  it('adds new asset and return assetCount=1', function *(done){
    const reqPath = '/assets/123?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST</CuttingTool>'
    })
    
    assert(body === '<success/>\r\n')
    assert(dataStorage.assetBuffer.length === 1)
    done()
  })

  it('returns newly added asset', function*(done){

    const { body } = yield request(url)
    const obj = parse(body)
    const { root } = obj
    const child = root.children[0].attributes
    const child1 = root.children[1].children[0]

    assert(Number(child.assetBufferSize) === maxAssets)
    assert(dataStorage.assetBuffer.length === Number(child.assetCount))
    assert(child1.name === 'CuttingTool')
    assert(child1.content === 'TEST')
    done()
  })

  it('device should generate change event', function *(done){

    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const assetChanged = root.children[1].children[0].children[0].children[0].children[1]
     
    assert(assetChanged.content === '123')
    assert(assetChanged.attributes.assetType === 'CuttingTool') 
    done()
  })
})

describe('testAssetBuffer', (done) => {
  const url = `http://${ip}:7000/assets`
  const maxAssets = 4
  let stub
  const success = '<success/>\r\n'
  const failed = '<failed/>\r\n'
  
  before(() => {
    schemaPtr.clear()
    dataStorage.assetBuffer.size = maxAssets
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashDataItemsByName.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['43444e50-a578-11e7-a3dd-28cfe91a82ef'])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.size = bufferSize
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashDataItemsByName.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })

  it('assetBufferSize should be 4 and assetCount 0', function *(done) {

    assert(maxAssets === dataStorage.assetBuffer.size)
    assert(dataStorage.assetBuffer.length === 0)
    done()
  })
  
  it('assetCount should be 1 once we add first asset', function *(done){
    const reqPath = '/assets/1?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 1</CuttingTool>'
    })

    assert(body === success)
    const assetArr = dataStorage.assetBuffer.toArray()
    assert(assetArr.length === 1)
    assert(assetArr[0].assetType === 'CuttingTool')
    done()
  })

  it('returns newly added asset on request', function *(done) {
    const reqPath = '/assets/1?type=CuttingTool&device=VMC-3Axis'  

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(Number(header.assetCount) === 1)
    assert(assets.length === 1)
    assert(assets[0].content === 'TEST 1')
    done()
  })

  it('make sure replace work properly', function *(done){
    const reqPath = '/assets/1?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 1</CuttingTool>'
    })

    assert(body === failed)
    const assetArr = dataStorage.assetBuffer.toArray()
    assert(assetArr.length === 1)
    assert(assetArr[0].assetType === 'CuttingTool')
    done()
  })

  it('returns assetCount=2 after posting another asset', function*(done){
    const reqPath = '/assets/2?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 2</CuttingTool>'
    })

    assert(body === success)
    const assetArr = dataStorage.assetBuffer.toArray()
    assert(assetArr.length === 2)
    R.map((asset) => {
      assert(asset.assetType === 'CuttingTool')
    }, assetArr)
    done()
  })

  it('prints newly added asset on request', function *(done) {
    const reqPath = '/assets/2?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(Number(header.assetCount) === 2)
    assert(assets.length === 1)
    assert(assets[0].content === 'TEST 2')
    done()
  })

  it('return assetCount=3 after posting 3rd asset', function*(done){
    const reqPath = '/assets/3?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 3</CuttingTool>'
    })

    assert(body === success)
    const assetArr = dataStorage.assetBuffer.toArray()
    assert(assetArr.length === 3)
    R.map((asset) => {
      assert(asset.assetType === 'CuttingTool')
    }, assetArr)
    done()
  })

  it('prints to the screen recently added asset if requested', function*(done){
    const reqPath = '/assets/3?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(Number(header.assetCount) === 3)
    assert(assets.length === 1)
    assert(assets[0].content === 'TEST 3')
    done()
  })

  it('returns assetCount=4 if posted 4th asset', function*(done){
    const reqPath = '/assets/4?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 4</CuttingTool>'
    })

    assert(body === success)
    const assetArr = dataStorage.assetBuffer.toArray()
    assert(assetArr.length === 4)
    R.map((asset) => {
      assert(asset.assetType === 'CuttingTool')
    },assetArr)
    done()
  }) 

  it('prints to the screen newly added asset if requested', function*(done){
    const reqPath = '/assets/4?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(Number(header.assetCount) === 4)
    assert(assets.length === 1)
    assert(assets[0].content === 'TEST 4')
    done()
  })

  it('test multiple assets get', function*(done){
    const reqPath = '/assets'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children
    let number = 4

    assert(Number(header.assetCount) === 4)
    assert(assets.length === 4)
    R.map((asset) => {
      assert(asset.content === `TEST ${number--}`)
    }, assets)
    done()
  })

  it('test multiple assets get with filters type and device', function*(done){
    const reqPath = '/assets?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children
    let number = 4

    assert(Number(header.assetCount) === 4)
    assert(assets.length === 4)
    R.map((asset) => {
      assert(asset.content === `TEST ${number--}`)
    }, assets)
    done()
  })

  it('test multiple assets get with filters type, device and count', function*(done){
    const reqPath = '/assets?type=CuttingTool&device=VMC-3Axis&count=2'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(Number(header.assetCount) === 4)
    assert(assets.length === 2)
    assert(assets[0].content === 'TEST 4')
    assert(assets[1].content === 'TEST 3')
    done()
  })

  it('after adding 5th asset assetCount should stay at 4', function*(done){
    const reqPath = '/assets/5?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 5</CuttingTool>'
    })

    assert(body === success)
    const assetArr = dataStorage.assetBuffer.toArray()
    assert(assetArr.length === 4)
    R.map((asset) => {
      assert(asset.assetType === 'CuttingTool')
    }, assetArr)
    done()
  })

  it('prints newly added asset if requested', function*(done){
    const reqPath = '/assets/5?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(assets.length === 1)
    assert(Number(header.assetCount) === maxAssets)
    assert(assets[0].content === 'TEST 5')
    done()
  })

  it('returns error ASSET_NOT_FOUND when requested assets/1', function*(done){
    const reqPath = '/assets/1'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const error = root.children[1].children[0]
    const errorCode = error.attributes.errorCode
    
    assert(error.content === 'Could not find asset: 1')
    assert(errorCode === 'ASSET_NOT_FOUND')
    done()
  })

  it('should return asset#2 if requested', function*(done){
    const reqPath = '/assets/2'

    const { body } =yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(assets.length === 1)
    assert(Number(header.assetCount) === maxAssets)
    assert(assets[0].content === 'TEST 2')
    done()
  })

  it('rewrites value of existing asset', function*(done){
    const reqPath = '/assets/3?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 6</CuttingTool>'
    })

    assert(body === success)
    const assets = dataStorage.assetBuffer.toArray()
    assert(assets.length === 4)
    R.map((asset) => {
      assert(asset.assetType === 'CuttingTool')
    }, assets)
    done()
  })

  it('returns new value if request assets/3', function*(done){
    const reqPath = '/assets/3?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(assets.length === 1)
    assert(Number(header.assetCount) === maxAssets)
    assert(assets[0].content === 'TEST 6')
    done()
  })

  it('should change value of asset#2 without inserting new entry to assetBuffer', function*(done){
    const reqPath = '/assets/2?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 7</CuttingTool>'
    })

    assert(body === success)
    const assets = dataStorage.assetBuffer.toArray()
    assert(assets.length === maxAssets)
    R.map((asset)=>{
      assert(asset.assetType === 'CuttingTool')
    }, assets)
    done()
  })

  it('should insert new asset to assetBuffer', function*(done){
    const reqPath = '/assets/6?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 8</CuttingTool>'
    })

    assert(body === success)
    const assets = dataStorage.assetBuffer.toArray()
    assert(assets.length === maxAssets)
    R.map((asset) => {
      assert(asset.assetType === 'CuttingTool')
    }, assets)
    done()
  })

  it('should print to the screen newly added asset#3', function*(done){
    const reqPath = '/assets/6?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(assets.length === 1)
    assert(Number(header.assetCount) === maxAssets)
    assert(assets[0].content === 'TEST 8')
    done()
  })

  it('should return ASSET_NOT_FOUND when requesting asset#4', function*(done){
    const reqPath = '/assets/4'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const error = root.children[1].children[0]
    const errorCode = error.attributes.errorCode
    
    assert(error.content === 'Could not find asset: 4')
    assert(errorCode === 'ASSET_NOT_FOUND')
    done()
  })

  it('should render assets as JSON', function*(done){
    const { body } = yield request({
      url: `http://${ip}:7000/assets`,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    const obj = JSON.parse(body)
    const assets = obj.MTConnectAssets.Assets[0].CuttingTool

    assert(assets.length === 4 && assets[0]._ === 'TEST 8' && assets[0].$.assetId === '6')
    assert(assets[3]._ === 'TEST 5' && assets[3].$.assetId === '5')
    done()
  })
})

describe('testAssetError()', () => {
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashDataItemsByName.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['43444e50-a578-11e7-a3dd-28cfe91a82ef'])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashDataItemsByName.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })

  it('should return errorCode ASSET_NOT_FOUND if request /assets/123', function*(done){
    const { body } = yield request(`http://${ip}:7000/assets/123`)
    const obj = parse(body)
    const { root } = obj
    const error = root.children[1].children[0]
    const errorCode = error.attributes.errorCode
    
    assert(error.content === 'Could not find asset: 123')
    assert(errorCode === 'ASSET_NOT_FOUND')
    done()
  })
})

describe('testAdapterAddAsset', () => {
  const str = 'TIME|@ASSET@|111|CuttingTool|<CuttingTool>TEST 1</CuttingTool>'
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  
  before(() => {
    schemaPtr.clear()
    dataStorage.assetBuffer.size = 4
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.size = bufferSize
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })

  it('should return assetCount=1 after insering new asset', (done) => {
    common.parsing(str, uuid)

    assert(dataStorage.assetBuffer.size === 4)
    assert(dataStorage.assetBuffer.length === 1)
    done()
  })

  it('returns newly added asset on request', function*(done){
    const { body } = yield request(`http://${ip}:7000/assets/111`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(assets.length === 1)
    assert(Number(header.assetCount) === dataStorage.assetBuffer.length)
    assert(assets[0].content === 'TEST 1')
    done()
  })
})

describe('testMultiLineAsset()', () => {
  const newAsset = 'TIME|@ASSET@|111|CuttingTool|--multiline--AAAA\n' +
                    '<CuttingTool>\n' +
                      ' <CuttingToolXXX>TEST 1</CuttingToolXXX>\n' +
                      ' Some Test\n' +
                      ' <Extra>XXX</Extra>\n' + 
                    '</CuttingTool>\n' +
                    '--multiline--AAAA\n'
  
  const update = 'TIME|line|204'
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  before(() => {
    schemaPtr.clear()
    dataStorage.assetBuffer.size = 4
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.size = bufferSize
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })

  it('it should accept multiline assets', function*() {
    common.parsing(newAsset, uuid)

    const { body } = yield request(`http://${ip}:7000/current`)
    assert(dataStorage.assetBuffer.size === 4)
    assert(dataStorage.assetBuffer.length === 1)
  })

  it('should return newly added asset when request /assets/111', function*(done){
    const reqPath = '/assets/111'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const parent = root.children[1].children[0].attributes
    const child1 = root.children[1].children[0].children[0]
    const child2 = root.children[1].children[0].children[1]
    const header = root.children[0].attributes

    assert(Number(header.assetCount) === 1)
    assert(child1.name === 'CuttingToolXXX')
    assert(child1.content === 'TEST 1')
    assert(child2.name === 'Extra')
    assert(child2.content === 'XXX')
    assert(parent.assetId === '111')
    assert(parent.deviceUuid === uuid)
    assert(parent.timestamp === 'TIME')
    done()
  })

  it('Make sure we can still add a line and we are out of multiline mode...', function*(done){
    common.parsing(update, uuid)

    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0].children[6].children[1].children[2]
    
    assert(child.name === 'Line')
    assert(child.content === '204')
    done()
  })
})

describe('testAssetProbe', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const success = '<success/>\r\n'
  const failed = '<failed/>\r\n'
  let stub

  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })

  it('inserts new asset', function*(done){
    const reqPath = '/assets/1?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 1</CuttingTool>'
    })

    assert(body === success)
    assert(dataStorage.assetBuffer.length === 1)
    done()
  })
    
  it('returns assetCount=2', function*(done){
    const reqPath = '/assets/2?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 1</CuttingTool>'
    })

    assert(body === success)
    assert(dataStorage.assetBuffer.length === 2)
    done()
  })

  it('returns assetCount=2 on /probe', function*(done){
    const { body } = yield request(`http://${ip}:7000/probe`)
    const obj = parse(body)
    const { root } = obj
    const assetCounts = root.children[0].children[0].children
    
    assert(assetCounts.length === 1)
    assert(assetCounts[0].content === '2' && assetCounts[0].attributes.assetType === 'CuttingTool')
    done()
  }) 
})

describe('testAssetRemoval', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const success = '<success/>\r\n'
  const failed = '<failed/>\r\n'
  let stub

  before(() => {
    schemaPtr.clear()
    dataStorage.assetBuffer.size = 4
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.size = bufferSize
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })
  
  it('returns assetBufferSize=0 and assetCount=0', ()=> {

    assert(dataStorage.assetBuffer.size === 4)
    assert(dataStorage.assetBuffer.length === 0)
  })

  it('inserts new asset with assetId=1', function*(done){
    const reqPath = '/assets/1?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 1</CuttingTool>'
    })

    assert(body === success)
    const assets = dataStorage.assetBuffer.toArray()
    assert(assets.length === 1)
    R.map((asset) => {
      assert(asset.assetType === 'CuttingTool')
    }, assets)
    done()
  })

  it('returns newly added asset on request', function *(done) {
    const reqPath = '/assets/1?type=CuttingTool&device=VMC-3Axis'  

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(Number(header.assetCount) === 1)
    assert(assets.length === 1)
    assert(assets[0].content === 'TEST 1')
    done()
  })

  it('make sure replace work properly', function *(done){
    const reqPath = '/assets/1?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 1</CuttingTool>'
    })

    assert(body === failed)
    const assetArr = dataStorage.assetBuffer.toArray()
    assert(assetArr.length === 1)
    assert(assetArr[0].assetType === 'CuttingTool')
    done()
  })

  it('returns assetCount=2 after posting another asset', function*(done){
    const reqPath = '/assets/2?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 2</CuttingTool>'
    })

    assert(body === success)
    const assetArr = dataStorage.assetBuffer.toArray()
    assert(assetArr.length === 2)
    R.map((asset) => {
      assert(asset.assetType === 'CuttingTool')
    }, assetArr)
    done()
  })

  it('prints newly added asset on request', function *(done) {
    const reqPath = '/assets/2?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(Number(header.assetCount) === 2)
    assert(assets.length === 1)
    assert(assets[0].content === 'TEST 2')
    done()
  })

  it('return assetCount=3 after posting 3rd asset', function*(done){
    const reqPath = '/assets/3?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 3</CuttingTool>'
    })

    assert(body === success)
    const assetArr = dataStorage.assetBuffer.toArray()
    assert(assetArr.length === 3)
    R.map((asset) => {
      assert(asset.assetType === 'CuttingTool')
    }, assetArr)
    done()
  })

  it('prints to the screen recently added asset if requested', function*(done){
    const reqPath = '/assets/3?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request(`http://${ip}:7000${reqPath}`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0].attributes
    const assets = root.children[1].children

    assert(Number(header.assetCount) === 3)
    assert(assets.length === 1)
    assert(assets[0].content === 'TEST 3')
    done()
  })

  it('should keep assetCount at 3 after setting assets/2 removed=true', function*(done){
    const reqPath = '/assets/2?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool removed="true">TEST 2</CuttingTool>'
    })

    assert(body === success)
    const assets = dataStorage.assetBuffer.toArray()
    assert(assets.length === 3)
    R.map((asset) => {
     assert(asset.assetType === 'CuttingTool')
    }, assets)
    done()
  })

  it('should generate EVENT assetRemoved on /current', function*(done){
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const assetRemoved = root.children[1].children[0].children[0].children[0].children[2]
    
    assert(assetRemoved.content === '2')
    assert(assetRemoved.attributes.assetType === 'CuttingTool')
    done()
  })

  it('should return 2 assets on /assets request but assetCount stays at 3', function*(done){
    const { body } = yield request(`http://${ip}:7000/assets`)
    const obj = parse(body)
    const { root } = obj
    const assets = root.children[1].children
    const header = root.children[0]
    
    assert(Number(header.attributes.assetCount) === 3)
    assert(assets.length === 2)
    assert(assets[1].content === 'TEST 1')
    assert(assets[0].content === 'TEST 3')
    done()
  })

  it('should display all 3 assets on /assets?return=true', function*(done){
    const { body } = yield request(`http://${ip}:7000/assets?removed=true`)
    const obj = parse(body)
    const { root } = obj
    const assets = root.children[1].children
    const header = root.children[0]
    //console.log(header)
    
    assert(Number(header.attributes.assetCount) === 3)
    assert(assets.length === 3)
    assert(assets[0].content === 'TEST 3')
    assert(assets[1].content === 'TEST 2' && assets[1].attributes.removed === 'true')
    assert(assets[2].content === 'TEST 1')
    done()
  })
})

describe('testAssetRemovalByAdapter()', () => {
  let stub
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const str = 'TIME|@ASSET@|111|CuttingTool|<CuttingTool>TEST 1</CuttingTool>'
  const str2 = 'TIME|@ASSET@|112|CuttingTool|<CuttingTool>TEST 2</CuttingTool>'
  const str3 = 'TIME|@ASSET@|113|CuttingTool|<CuttingTool>TEST 3</CuttingTool>'

  before(() => {
    schemaPtr.clear()
    dataStorage.assetBuffer.size = 4
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.size = bufferSize
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })

  it('should generate new EVENT assetChanged', function*(done){
    assert(dataStorage.assetBuffer.length === 0)
    assert(dataStorage.assetBuffer.size === 4)

    common.parsing(str, uuid)

    assert(dataStorage.assetBuffer.length === 1)

    common.parsing(str2, uuid)
  
    assert(dataStorage.assetBuffer.length === 2)

    common.parsing(str3, uuid)
    
    assert(dataStorage.assetBuffer.length === 3)

    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const assetChanged = root.children[1].children[0].children[0].children[0].children[1]
    
    assert(assetChanged.content === '113')
    assert(assetChanged.attributes.assetType === 'CuttingTool')
    done()
  })

  it('should generate new assetRemoved EVENT', function*(done){
    const str = 'TIME|@REMOVE_ASSET@|112'
    common.parsing(str, uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const assetRemoved = root.children[1].children[0].children[0].children[0].children[2]
    
    assert(dataStorage.assetBuffer.length === 3)
    assert(assetRemoved.content === '112')
    assert(assetRemoved.attributes.assetType === 'CuttingTool')
    done()
  })

  it('should return assetCount=3 but print to the screen only 2', function*(done){
    const { body } = yield request(`http://${ip}:7000/assets`)
    const obj = parse(body)
    const { root } = obj
    const header = root.children[0]
    const assets = root.children[1].children
    
    assert(assets.length === 2)
    assert(Number(header.attributes.assetCount) === 3)
    assert(assets[0].content === 'TEST 3')
    assert(assets[1].content === 'TEST 1')
    done()
  })

  it('should return all 3 assets on request /assets?removed=true', function*(done){
    const { body } = yield request(`http://${ip}:7000/assets?removed=true`)
    const obj = parse(body)
    const { root } = obj
    const assets = root.children[1].children
    const header = root.children[0]

    assert(Number(header.attributes.assetCount) === 3)
    assert(assets.length === 3)
    assert(assets[0].content === 'TEST 3')
    assert(assets[1].content === 'TEST 2')
    assert(assets[1].attributes.removed === 'true')
    assert(assets[2].content === 'TEST 1')
    done()
  })
})
describe('testAssetStorageWithoutType()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  before(() => {
    schemaPtr.clear()
    dataStorage.assetBuffer.size = 4
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.size = bufferSize
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })
  it('should not add asset without type', function*(done){
    const reqPath = '/assets/123?device=VMC-3Axis'

    assert(dataStorage.assetBuffer.size === 4)
    assert(dataStorage.assetBuffer.length === 0)

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST</CuttingTool>'
    })

    assert(body === '<failed/>\r\n')
    assert(dataStorage.assetBuffer.length === 0)
    done()
  })
})

describe('testAssetWithSimpleCuttingItems()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })

  it('adds new asset and returns assetCount 1', () => {
    const str = 'TIME|@ASSET@|XXX.200|CuttingTool|--multiline--AAAA\n' + 
                '<CuttingTool toolId="XXX" serialNumber="200" assetId="XXX.200" xmlns:x="urn:machine.com:MachineAssets:1.3">' +
                '<Description />' +
                '<CuttingToolLifeCycle>' +
                '<Location type="POT" positiveOverlap="0" negativeOverlap="0">4</Location>' +
                '<ProgramToolNumber>200</ProgramToolNumber>' +
                '<CuttingItems count="4">' +
                '<CuttingItem indices="1">' +
                '<ItemLife type="PART_COUNT" countDirection="UP" initial="0" limit="0">0</ItemLife>' +
                '<x:ItemCutterStatus>' +
                '<Status>AVAILABLE</Status>' +
                '</x:ItemCutterStatus>' +
                '</CuttingItem><CuttingItem indices="2">' +
                '<ItemLife type="PART_COUNT" countDirection="UP" initial="0" limit="0">0</ItemLife>' +
                '<x:ItemCutterStatus>' +
                '<Status>USED</Status>' +
                '</x:ItemCutterStatus>' +
                '</CuttingItem><CuttingItem indices="3">' +
                '<ItemLife type="PART_COUNT" countDirection="UP" initial="0" limit="0">0</ItemLife>' +
                '</CuttingItem><CuttingItem indices="4">' +
                '<ItemLife type="PART_COUNT" countDirection="UP" initial="0" limit="0">0</ItemLife>' +
                '</CuttingItem>' +
                '</CuttingItems>' +
                '</CuttingToolLifeCycle>' +
                '</CuttingTool>' +
                '--multiline--AAAA\n'
    common.parsing(str, uuid)
    
    const assets = dataStorage.assetBuffer.toArray()
    assert(assets.length === 1)
  })
  
  it('renders asset with all CuttingItems', function*(done){
    const { body } = yield request(`http://${ip}:7000/assets/XXX.200`)
    const obj = parse(body)
    const { root } = obj
    const cuttingItems = root.children[1].children[0].children[0].children[2].children 
    const itemLife1 = cuttingItems[0].children[0]
    const itemLife4 = cuttingItems[3].children[0]
    const cutterStatus1 = cuttingItems[0].children[1].children[0]
    const cutterStatus2 = cuttingItems[1].children[1].children[0]
    
    assert(cuttingItems.length === 4)
    assert(itemLife1.content === '0' && itemLife1.attributes.type === 'PART_COUNT' &&
          itemLife1.attributes.countDirection === 'UP' && itemLife1.attributes.initial === '0' && 
          itemLife1.attributes.limit === '0')
    assert(cutterStatus1.content === 'AVAILABLE' && cutterStatus2.content === 'USED')
    assert(itemLife4.content === '0' && itemLife4.attributes.type === 'PART_COUNT' &&
          itemLife4.attributes.countDirection === 'UP' && itemLife4.attributes.initial === '0' && 
          itemLife4.attributes.limit === '0')
    done()
  })
})

describe('testRemoveLastAssetChanged()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.size = 4
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.size = bufferSize
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })

  it('returns assetBuffer size 4', () => {
    assert(dataStorage.assetBuffer.size === 4)
    assert(dataStorage.assetBuffer.length === 0)
  })
  
  it('adds new asset and returns assetCount 1', () => {
    const str = 'TIME|@ASSET@|111|CuttingTool|<CuttingTool>TEST 1</CuttingTool>'
    common.parsing(str, uuid)

    assert(dataStorage.assetBuffer.length === 1)
  })

  it('generates assetChanged event on /current', function*(done){
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const assetChanged = root.children[1].children[0].children[0].children[0].children[1]
    
    assert(assetChanged.content === '111' && assetChanged.attributes.assetType === 'CuttingTool')
    done()
  })

  it('returns assetCount 1 after REMOVE_ASSET event', () => {
    const str = 'TIME|@REMOVE_ASSET@|111'
    common.parsing(str, uuid)

    assert(dataStorage.assetBuffer.length === 1)
  })

  it('generates assetChanged and assetRemoved events', function*(done){
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const assetChanged = root.children[1].children[0].children[0].children[0].children[1]
    const assetRemoved = root.children[1].children[0].children[0].children[0].children[2]
    
    assert(assetChanged.content === 'UNAVAILABLE' && assetChanged.attributes.assetType === 'CuttingTool')
    assert(assetRemoved.content === '111' && assetChanged.attributes.assetType === 'CuttingTool')    
    done()
  })
})

describe.skip('testPutBlocking()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })
  
  //does not work yet
  it('should generate ERROR "Only the HTTP GET request is supported"', function*(done){
    const reqPath = '/assets/2?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST</CuttingTool>'
    })
    done()
  })
})

describe('testingPUT and updateAssetCollection()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })

  it('adds asset', function*(done){
    assert(dataStorage.assetBuffer.length === 0)

    const reqPath = '/assets/1?type=CuttingTool&device=VMC-3Axis'

    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 1</CuttingTool>'
    })

    assert(body === '<success/>\r\n')
    assert(dataStorage.assetBuffer.length === 1)
    done()
  })

  it('uses updateAssetCollectionTruPUT on PUT', function*(done){
    const reqPath = '/assets/1?type=CuttingTool&device=VMC-3Axis'
    const spy = sinon.spy(lokijs, 'updateAssetCollectionThruPUT')


    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: '<CuttingTool>TEST 2</CuttingTool>'
    })
    
    assert(body === '<success/>\r\n')
    assert(dataStorage.assetBuffer.length === 2)
    assert(spy.callCount === 1)
    done()
  })
})

describe('working with 2 adapters', () => {
  const uuid1 = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const uuid2 = '3f707e77-7b44-55a0-9aba-2a671d5e7089'
  
  const deviceForConfig = {
    '$': { id: 'dev', iso841Class: '6', name: 'VMC-4Axis', uuid: uuid2 }
  }
  
  const path = 'path=//DataItem[@type="AVAILABILITY"]'
  
  const device = {
    address: '10.0.0.193',
    ip: '7879',
    uuid: uuid1
  }

  const device2 = {
    address: '10.0.0.193',
    ip: '7878',
    uuid: uuid2
  }
  
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    devices.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    lokijs.setDefaultConfigsForDevice('VMC-4Axis')
    dataStorage.setConfiguration(deviceForConfig, 'AutoAvailable', true)
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    devices.insert(device)
    const xml2 = fs.readFileSync('./adapters/simulator2/public/VMC-3Axis1.xml', 'utf8')
    lokijs.updateSchemaCollection(xml2)
    devices.insert(device2)
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    devices.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
  })

  it('stores 2 schemas', () => {
    assert(dataStorage.getConfiguredVal(deviceForConfig.$.name, 'AutoAvailable') === true)
    assert(schemaPtr.data.length === 2)
    assert(devices.count() === 2)
  })

  it('should update only one dataItem', function*(done) {
    const str = '2016-07-25T05:50:22.303002Z|spindle_speed|200'
    common.parsing(str, uuid1)
    
    const { body } = yield request(`http://${ip}:7000/current?path=//DataItem[@name="Sspeed"]`)
    const obj = parse(body)
    const { root } = obj
    const dataItem111 = root.children[1].children[0].children[0].children[0].children[0]
    const dataItem000 = root.children[1].children[1].children[0].children[0].children[0]
    
    assert(dataItem000 !== dataItem111)
    assert(dataItem000.content === '200')
    assert(dataItem111.content === 'UNAVAILABLE')
    done()
  })

  it('returns Availability as AVAILABLE for VMC-4Axis', function*(done){
    const { body } = yield request(`http://${ip}:7000/sample?${path}`)
    const obj = parse(body)
    const { root } = obj
    const avail1 = root.children[1].children[0].children[0].children[0].children[0]
    const avail2 = root.children[1].children[1].children[0].children[0].children[0]
    
    assert(avail1.name === 'Availability' && avail1.content === 'AVAILABLE')
    assert(avail2.name === 'Availability' && avail2.content === 'UNAVAILABLE')
    done()
  })
  
  it('returns Availability as UNAVAILABLE for VMC-4Axis after device has been disconnected', function*(done){
    devices.findAndRemove({ uuid: uuid2 })

    const { body } = yield request(`http://${ip}:7000/current?${path}`)
    const obj = parse(body)
    const { root } = obj
    const avail1 = root.children[1].children[0].children[0].children[0].children[0]
    const avail2 = root.children[1].children[1].children[0].children[0].children[0]

    assert(avail1.name === 'Availability' && avail1.content === 'UNAVAILABLE')
    assert(avail2.name === 'Availability' && avail2.content === 'UNAVAILABLE')
    done()
  })
  it('returns Availability as AVAILABLE for VMC-4Axis after connected back', function*(done){
    const xml = fs.readFileSync('./adapters/simulator2/public/VMC-3Axis1.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    devices.insert(device2)

    const { body } = yield request(`http://${ip}:7000/current?${path}`)
    const obj = parse(body)
    const { root } = obj
    const avail1 = root.children[1].children[0].children[0].children[0].children[0]
    const avail2 = root.children[1].children[1].children[0].children[0].children[0]
    
    assert(avail1.name === 'Availability' && avail1.content === 'AVAILABLE')
    assert(avail2.name === 'Availability' && avail2.content === 'UNAVAILABLE')
    done()
  })

  it('returns 3 dataItems type Availability for VMC-4Axis on /sample', function*(done){
    const { body } = yield request(`http://${ip}:7000/sample?${path}`)
    const obj = parse(body)
    const { root } = obj
    const avail1 = root.children[1].children[0].children[0].children[0].children
    const avail2 = root.children[1].children[1].children[0].children[0].children
    
    assert(avail1.length === 3 && avail2.length === 1)
    assert(avail1[0].content === 'AVAILABLE' && avail1[1].content === 'UNAVAILABLE' && avail1[2].content === 'AVAILABLE')
    assert(avail2[0].content === 'UNAVAILABLE')
    done()
  })
})

describe('testDiscrete()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/descrete_example.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('returns dataItem "message" with representation DISCRETE', () => {
    const dataItem = lokijs.getDataItem(uuid, 'message')

    assert(dataItem !== undefined)
    assert(dataItem.$.representation === 'DISCRETE')
  })

  it('returns dataItem "Line" as UNAVAILABLE', function*(done){
    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const eventsItems = root.children[1].children[0].children[2].children[0].children
    const lines = R.filter(item => item.name === 'Line', eventsItems)

    assert(lines.length === 1)
    assert(lines[0].name === 'Line')
    assert(lines[0].content === 'UNAVAILABLE')
    done()
  })

  it('should not insert duplicates', function*(done){
    const arr = ['TIME|line|204', 'TIME|line|204', 'TIME|line|205']
    R.map((str) => {
      common.parsing(str, uuid)
    }, arr)

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const eventsItems = root.children[1].children[0].children[2].children[0].children
    const messageDiscrete = R.filter(item => item.name === 'MessageDiscrete', eventsItems)
    const lines = R.filter(item => item.name === 'Line', eventsItems)

    assert(lines.length === 3)
    R.map((line) => {
      assert(line.name === 'Line')
    }, lines)
    assert(lines[2].content === '205')
    assert(lines[1].content === '204')
    assert(lines[0].content === 'UNAVAILABLE')
    
    assert(messageDiscrete[0].name === 'MessageDiscrete')
    assert(messageDiscrete[0].content === 'UNAVAILABLE')
    done()
  })

  it('should not check for dups if discrete is true', function*(done){
    const arr = ['TIME|message|Hi|Hello', 'TIME|message|Hi|Hello', 'TIME|message|Hi|Hello']
    R.map((str) => {
      common.parsing(str, uuid)
    }, arr)

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const eventsItems = root.children[1].children[0].children[2].children[0].children
    const messageDiscrete = R.filter(item => item.name === 'MessageDiscrete', eventsItems)
    
    assert(messageDiscrete.length === 4)
    R.map((message) => {
      assert(message.name === 'MessageDiscrete')
    }, messageDiscrete)
    assert(messageDiscrete[0].content === 'UNAVAILABLE')
    assert(messageDiscrete[1].content === 'Hello')
    assert(messageDiscrete[2].content === 'Hello')
    assert(messageDiscrete[3].content === 'Hello')
    done()
  })
})

describe('testConditionSequence()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('returns dataItem clp',function*(done){
    const id = lokijs.getDataItem(uuid, 'clp').$.id
    assert(id !== undefined)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const items = root.children[1].children[0].children[5].children[1].children
    const lp = R.filter(item => item.attributes.dataItemId === id, items)

    assert(lp.length === 1)
    assert(lp[0].name === 'Unavailable')
    done()
  })

  it('checks for dups', function*(done){
    common.parsing('TIME|clp|NORMAL||||XXX', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const conditionItems = root.children[1].children[0].children[5].children[1].children
    const normalItem = R.filter(item => item.name !== 'Unavailable', conditionItems)
    
    assert(normalItem.length === 1)
    assert(normalItem[0].name === 'Normal')
    assert(normalItem[0].content === 'XXX')
    done()
  })

  it('changes normal status to fault', function*(done){
    common.parsing('TIME|clp|FAULT|2218|ALARM_B|HIGH|2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF', uuid)

    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const conditionItems = root.children[1].children[0].children[5].children[1].children
    const faultItem = R.filter(item => item.name !== 'Unavailable', conditionItems)

    assert(faultItem.length === 1)
    assert(faultItem[0].name === 'Fault')
    assert(faultItem[0].content === '2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF')
    assert(faultItem[0].attributes.nativeCode === '2218')
    assert(faultItem[0].attributes.nativeSeverity === 'ALARM_B')
    assert(faultItem[0].attributes.qualifier === 'HIGH')
    done()
  })

  it('changes status back to normal', function*(done){
    const id = lokijs.getDataItem(uuid, 'clp').$.id
    common.parsing('TIME|clp|NORMAL||||', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const conditionItems = root.children[1].children[0].children[5].children[1].children
    const normalItems = R.filter(item => item.attributes.dataItemId === id, conditionItems)
    const normalItem = R.filter(item => item.name === 'Normal', normalItems)

    assert(normalItems.length === 1)
    assert(normalItem.length === 1)
    done()
  })

  it('changes normal status to fault again', function*(done){
    common.parsing('TIME|clp|FAULT|4200|ALARM_D||4200 ALARM_D Power on effective parameter set', uuid)

    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const conditionItems = root.children[1].children[0].children[5].children[1].children
    const faultItems = R.filter(item => item.name === 'Fault', conditionItems)

    assert(faultItems.length === 1)
    assert(faultItems[0].name === 'Fault')
    assert(faultItems[0].content === '4200 ALARM_D Power on effective parameter set')
    assert(faultItems[0].attributes.nativeCode === '4200')
    assert(faultItems[0].attributes.nativeSeverity === 'ALARM_D')
    done()
  })

  it('adds second fault', function*(done){
    common.parsing('TIME|clp|FAULT|2218|ALARM_B|HIGH|2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[5].children[1].children
    const faults = R.filter(item => item.name === 'Fault', children)

    assert(faults.length === 2)
    assert(faults[0].content === '4200 ALARM_D Power on effective parameter set')
    assert(faults[1].content === '2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF')
    assert(faults[1].attributes.nativeCode === '2218')
    assert(faults[1].attributes.nativeSeverity === 'ALARM_B')
    assert(faults[1].attributes.qualifier === 'HIGH')
    done()
  })

  it('should check for duplicates', function*(done){
    common.parsing('TIME|clp|FAULT|4200|ALARM_D||4200 ALARM_D Power on effective parameter set', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[5].children[1].children
    const faults = R.filter(item => item.name === 'Fault', children)

    assert(faults.length === 2)
    assert(faults[0].content === '4200 ALARM_D Power on effective parameter set')
    assert(faults[1].content === '2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF')
    assert(faults[1].attributes.nativeCode === '2218')
    assert(faults[1].attributes.nativeSeverity === 'ALARM_B')
    assert(faults[1].attributes.qualifier === 'HIGH')
    done()
  })

  it('should return one fault', function*(done){
    common.parsing('TIME|clp|NORMAL|2218|||', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[5].children[1].children
    const faults = R.filter(item => item.name === 'Fault', children)

    assert(faults.length === 1)
    assert(faults[0].content === '4200 ALARM_D Power on effective parameter set')
    assert(faults[0].attributes.nativeCode === '4200')
    done()
  })

  it('should return only normal', function*(done){
    common.parsing('TIME|clp|NORMAL||||', uuid)

    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[5].children[1].children
    const normal = R.filter(item => item.name === 'Normal', children)

    assert(normal.length === 1)
    done()
  })
})

describe('testEmptyLastItemFromAdapter()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('gets dataItems by Ids', () => {
    const block = lokijs.getDataItem(uuid, 'block')
    const program = lokijs.getDataItem(uuid, 'program')
    assert(block !== undefined)
    assert(program !== undefined)
  })

  it('returns content for those dataItems as UNAVAILABLE', function*(done){
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const items = root.children[1].children[0].children[6].children[1].children
    const blocks = []
    const programs = []
    R.filter((item) => {
      if(item.name === 'Block') blocks.push(item)
      if(item.name === 'Program') programs.push(item)
      return 0
    }, items)
    
    assert(blocks.length === 1 && programs.length === 1)
    assert(blocks[0].content === 'UNAVAILABLE' && programs[0].content === 'UNAVAILABLE')
    done()
  })

  it('updates their values', function*(done){
    common.parsing('TIME|program|A|block|B', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const block = root.children[1].children[0].children[6].children[1].children[0]
    const program = root.children[1].children[0].children[6].children[1].children[3]

    assert(block.name === 'Block' && block.content === 'B')
    assert(program.name === 'Program' && program.content === 'A')
    done()
  })

  it('further updates dataitem named Program', function*(done){
    common.parsing('TIME|program||block|B', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const block = root.children[1].children[0].children[6].children[1].children[0]
    const program = root.children[1].children[0].children[6].children[1].children[3]

    assert(block.name === 'Block' && block.content === 'B')
    assert(program.name === 'Program' && program.content === undefined)
    done()
  })
  it('further updates dataItem named Block', function*(done){
    common.parsing('TIME|program||block|', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const block = root.children[1].children[0].children[6].children[1].children[0]
    const program = root.children[1].children[0].children[6].children[1].children[3]

    assert(block.name === 'Block' && block.content === undefined)
    assert(program.name === 'Program' && program.content === undefined)
    done()
  })

  it('another updated info for Block and Program', function*(done){
    const arr = ['TIME|program|A|block|B', 'TIME|program|A|block|']
    R.map((str) => {
      common.parsing(str, uuid)
    }, arr)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const block = root.children[1].children[0].children[6].children[1].children[0]
    const program = root.children[1].children[0].children[6].children[1].children[3]
    
    assert(block.name === 'Block' && block.content === undefined)
    assert(program.name === 'Program' && program.content === 'A')
    done()
  })

  it('new update for Block, Program and Line', function*(done){
    const arr = ['TIME|program|A|block|B|line|C', 'TIME|program|D|block||line|E']
    R.map((str) => {
      common.parsing(str, uuid)
    }, arr)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const block = root.children[1].children[0].children[6].children[1].children[0]
    const program = root.children[1].children[0].children[6].children[1].children[3]
    const line = root.children[1].children[0].children[6].children[1].children[2]
    
    assert(block.name === 'Block' && block.content === undefined)
    assert(program.name === 'Program' && program.content === 'D')
    assert(line.name === 'Line' && line.content === 'E')
    done()
  })
})

describe('make sure new components are added', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/reference_example.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })
  it('should add Door and BarFeederInterface components and dataItems associated with them on requests /sample and /current', function*(done){
    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const door = root.children[1].children[0].children[3]
    const barFeeder = root.children[1].children[0].children[4]
    const doorDataItem = door.children[0].children[0]
    const barFeederDataItem = barFeeder.children[0].children[0]
    
    assert(door.attributes.component === 'Door')
    assert(doorDataItem.content === 'UNAVAILABLE' && doorDataItem.name === 'DoorState')
    assert(barFeeder.attributes.component === 'BarFeederInterface')
    assert(barFeederDataItem.content === 'UNAVAILABLE' && barFeederDataItem.name === 'MaterialFeed') 
    done()
  })
})

describe('testReferences()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/reference_example.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('return references to dataitem d_c4 and d_d2', function*(done){
    const item = lokijs.getDataItem(uuid, 'feed')
    const componentName = dataItemjs.getComponentName(item)
    const latestSchema = lokijs.searchDeviceSchema(uuid)
    const foundComponent = componentjs.findComponent(latestSchema, componentName)
    const references = componentjs.getReferences(foundComponent)

    assert(references.length === 2)
    assert(references[0].$.name === 'chuck' && references[1].$.name === 'door')
    assert(references[0].$.dataItemId === lokijs.getDataItem(uuid, 'chuck').$.id)
    assert(references[1].$.dataItemId === lokijs.getDataItem(uuid, 'door').$.id)
    done()
  })

  it('returns Door and Rotary components with BarFeederInterface componet when request /current?path=//BarFeederInterface', function*(done){
    const { body } = yield request(`http://${ip}:7000/current?path=//BarFeederInterface`)
    const obj = parse(body)
    const { root } = obj
    const componentStream = root.children[1].children[0].children
    const barFeeder = componentStream[0]
    const barItem = barFeeder.children[0].children[0]
    const rotary = componentStream[1]
    const rotaryItem = rotary.children[0].children[0]
    const door = componentStream[2]
    const doorItem = door.children[0].children[0]
    
    assert(componentStream.length === 3)
    assert(barFeeder.attributes.component === 'BarFeederInterface' && barItem.name === 'MaterialFeed' && barItem.content === 'UNAVAILABLE')
    assert(rotary.attributes.component === 'Rotary' && rotaryItem.name === 'ChuckState' && rotaryItem.content === 'UNAVAILABLE')
    assert(door.attributes.component === 'Door' && doorItem.name === 'DoorState' && doorItem.content === 'UNAVAILABLE')
    done()
  })
  
  it('returns Door and Rotary components with BarFeederInterface componet when request /current?path=//Interfaces', function*(done){
    const { body } = yield request(`http://${ip}:7000/current?path=//Interfaces`)
    const obj = parse(body)
    const { root } = obj
    const componentStream = root.children[1].children[0].children
    const barFeeder = componentStream[0]
    const barItem = barFeeder.children[0].children[0]
    const rotary = componentStream[1]
    const rotaryItem = rotary.children[0].children[0]
    const door = componentStream[2]
    const doorItem = door.children[0].children[0]
    
    assert(componentStream.length === 3)
    assert(barFeeder.attributes.component === 'BarFeederInterface' && barItem.name === 'MaterialFeed' && barItem.content === 'UNAVAILABLE')
    assert(rotary.attributes.component === 'Rotary' && rotaryItem.name === 'ChuckState' && rotaryItem.content === 'UNAVAILABLE')
    assert(door.attributes.component === 'Door' && doorItem.name === 'DoorState' && doorItem.content === 'UNAVAILABLE')
    done()
  })
})

describe('condition data items',  () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('returns normal for dataItem clp', function*(done){
    common.parsing('TIME|clp|NORMAL||||', uuid)

    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[5].children[1].children
    const normal = R.filter(item => item.name === 'Normal', children)

    assert(normal.length === 1)
    done()
  })

  it('replace normal condition with warning', function*(done){
    common.parsing('TIME|clp|WARNING|2218|ALARM_B|HIGH|2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[5].children[1].children
    const warning = R.filter(item => item.name === 'Warning', children)

    assert(warning.length === 1)
    assert(warning[0].content === '2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF')
    assert(warning[0].attributes.nativeCode === '2218')
    done()
  })

  it('adds another warning with different nativeCode', function*(done){
    common.parsing('TIME|clp|WARNING|4200|ALARM_D||4200 ALARM_D Power on effective parameter set', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[5].children[1].children
    const warning = R.filter(item => item.name === 'Warning', children)

    assert(warning.length === 2)
    assert(warning[0].content === '2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF')
    assert(warning[0].attributes.nativeCode === '2218')
    assert(warning[1].content === '4200 ALARM_D Power on effective parameter set')
    assert(warning[1].attributes.nativeCode === '4200')
    done()
  })

  it('adds another warning with different nativeCode', function*(done){
    common.parsing('TIME|clp|WARNING|3600|ALARM_C||3600 ALARM_C Power on effective parameter set', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[5].children[1].children
    const warning = R.filter(item => item.name === 'Warning', children)

    assert(warning.length === 3)
    assert(warning[0].content === '2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF')
    assert(warning[0].attributes.nativeCode === '2218')
    assert(warning[1].content === '4200 ALARM_D Power on effective parameter set')
    assert(warning[1].attributes.nativeCode === '4200')
    assert(warning[2].content === '3600 ALARM_C Power on effective parameter set')
    assert(warning[2].attributes.nativeCode === '3600')
    done()
  })

  it('adds another warning with different nativeCode', function*(done){
    common.parsing('TIME|clp|WARNING|3600|ALARM_C||3600 ALARM_C Power on effective parameter set', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[5].children[1].children
    const warning = R.filter(item => item.name === 'Warning', children)

    assert(warning.length === 3)
    assert(warning[0].content === '2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF')
    assert(warning[0].attributes.nativeCode === '2218')
    assert(warning[1].content === '4200 ALARM_D Power on effective parameter set')
    assert(warning[1].attributes.nativeCode === '4200')
    assert(warning[2].content === '3600 ALARM_C Power on effective parameter set')
    assert(warning[2].attributes.nativeCode === '3600')
    done()
  })

  it('replace warning with fault', function*(done){
    const id = lokijs.getDataItem(uuid, 'clp').$.id
    common.parsing('TIME|clp|FAULT|2218|ALARM_B|HIGH|2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[5].children[1].children
    const items = R.filter(item => item.attributes.dataItemId === id, children)
    const warning = []
    const fault = []
    
    R.map((item) => {
      if(item.name === 'Warning'){
        warning.push(item)
      }
      if(item.name === 'Fault'){
        fault.push(item)
      }
    }, items)
    
    assert(warning.length === 2 && fault.length === 1 && items.length === 3)
    assert(fault[0].content === '2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF')
    assert(fault[0].attributes.nativeCode === '2218')
    assert(warning[0].content === '4200 ALARM_D Power on effective parameter set')
    assert(warning[0].attributes.nativeCode === '4200')
    assert(warning[1].content === '3600 ALARM_C Power on effective parameter set')
    assert(warning[1].attributes.nativeCode === '3600')
    done()
  })

  it('returns one fault and 2 warnings for name clp', function*(done){
    
    const { body } = yield request(`http://${ip}:7000/current?path=//Controller//DataItem[@type="LOGIC_PROGRAM"]`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children
    const fault = []
    const warning = []
    
    R.map((item) => {
      if(item.name === 'Warning'){
        warning.push(item)
      }
      if(item.name === 'Fault'){
        fault.push(item)
      }
    }, children)

    assert(warning.length === 2 && fault.length === 1 && children.length === 3)
    assert(fault[0].content === '2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF')
    assert(fault[0].attributes.nativeCode === '2218')
    assert(warning[0].content === '4200 ALARM_D Power on effective parameter set')
    assert(warning[0].attributes.nativeCode === '4200')
    assert(warning[1].content === '3600 ALARM_C Power on effective parameter set')
    assert(warning[1].attributes.nativeCode === '3600')
    done()
  })

  it('returns everything for dataType LOGIC_PROGRAM', function*(done){

    const { body } = yield request(`http://${ip}:7000/current?path=//Controller//DataItem[@type="LOGIC_PROGRAM"]`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children
    const fault = []
    const warning = []
    
    R.map((item) => {
      if(item.name === 'Warning'){
        warning.push(item)
      }
      if(item.name === 'Fault'){
        fault.push(item)
      }
    }, children)

    assert(warning.length === 2 && fault.length === 1 && children.length === 3)
    assert(fault[0].content === '2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF')
    assert(fault[0].attributes.nativeCode === '2218')
    assert(warning[0].content === '4200 ALARM_D Power on effective parameter set')
    assert(warning[0].attributes.nativeCode === '4200')
    assert(warning[1].content === '3600 ALARM_C Power on effective parameter set')
    assert(warning[1].attributes.nativeCode === '3600')
    done()
  })
  
  it('returns everything for id name clp at /current?path=&at=', function*(done){
    const sequence = dataStorage.getSequence()
    const lastSequence = sequence.lastSequence

    const { body } = yield request(`http://${ip}:7000/current?path=//Controller&at=${lastSequence}`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[1].children
    const fault = []
    const warning = []
    
    R.map((item) => {
      if(item.name === 'Warning'){
        warning.push(item)
      }
      if(item.name === 'Fault'){
        fault.push(item)
      }
    }, children)
    
    assert(warning.length === 2 && fault.length === 1)
    assert(fault[0].content === '2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF')
    assert(fault[0].attributes.nativeCode === '2218')
    assert(warning[1].content === '4200 ALARM_D Power on effective parameter set')
    assert(warning[1].attributes.nativeCode === '4200')
    assert(warning[0].content === '3600 ALARM_C Power on effective parameter set')
    assert(warning[0].attributes.nativeCode === '3600')
    done()
  })

  it('returns 2 dataItem for component Controller', function*(done){
    const sequence = dataStorage.getSequence()
    const lastSequence = sequence.lastSequence - 1

    const { body } = yield request(`http://${ip}:7000/sample?path=//Controller&from=${lastSequence}&count=2`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children
    
    assert(children.length === 2)
    assert(children[1].content === '2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF')
    assert(children[0].content === '3600 ALARM_C Power on effective parameter set')
    done()
  })

  it('replace warning with nativeCode 4200 with fault', function*(done){
    common.parsing('TIME|clp|FAULT|4200|ALARM_D||4200 ALARM_D Power on effective parameter set', uuid)

    const { body } = yield request(`http://${ip}:7000/current?path=//Controller//DataItem[@type="LOGIC_PROGRAM"]`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children
    
    assert(children.length === 3)
    assert(children[0].name === 'Fault' && children[0].attributes.nativeCode === '2218')
    assert(children[1].name === 'Fault' && children[1].attributes.nativeCode === '4200')
    assert(children[2].name === 'Warning' && children[2].attributes.nativeCode === '3600')
    done()
  })

  it('return 2 dataItems with name clp', function*(done){
    common.parsing('TIME|clp|NORMAL|4200|||', uuid)

    const { body } = yield request(`http://${ip}:7000/current?path=//Controller//DataItem[@type="LOGIC_PROGRAM"]`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children

    assert(children.length === 2)
    assert(children[0].name === 'Fault' && children[0].attributes.nativeCode === '2218')
    assert(children[1].name === 'Warning' && children[1].attributes.nativeCode === '3600')
    done()
  })

  it('return 1 dataItem with id=dev_clp', function*(done){
    common.parsing('TIME|clp|NORMAL|3600|||', uuid)
    
    const { body } = yield request(`http://${ip}:7000/current?path=//Controller//DataItem[@type="LOGIC_PROGRAM"]`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children

    assert(children.length === 1)
    assert(children[0].name === 'Fault' && children[0].attributes.nativeCode === '2218')
    done()
  })

  it('return normal for id=dev_clp when /current?path=', function*(done){
    common.parsing('TIME|clp|NORMAL|2218|||', uuid)
    
    const sequence = dataStorage.getSequence()
    const lastSequence = sequence.lastSequence
    
    const { body } = yield request(`http://${ip}:7000/current?path=//Controller//DataItem[@type="LOGIC_PROGRAM"]`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children
    
    assert(children.length === 1)
    assert(children[0].name === 'Normal' && children[0].attributes.nativeCode === undefined)
    done()
  })
})

describe('Normal for condition dataITems',() => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('returns 3 dataItems clp', () => {
    const id = lokijs.getDataItem(uuid, 'clp').$.id
    const arr = ['TIME|clp|FAULT|2218|ALARM_B|HIGH|2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF', 'TIME|clp|FAULT|4200|ALARM_D||4200 ALARM_D Power on effective parameter set', 'TIME|clp|WARNING|3600|ALARM_C||3600 ALARM_C Power on effective parameter set']
    R.map((str) => {
      common.parsing(str, uuid)
    }, arr)

    const map = dataStorage.hashCondition.get(id)
    const items = Array.from(map.values())
    assert(items.length === 3)
    assert(items[0].value[0] === 'FAULT' && items[1].value[0] === 'FAULT' && items[2].value[0] === 'WARNING')
  })

  it('clears all warnings and faults and only return normal', function*(done){
    common.parsing('TIME|clp|NORMAL||||', uuid)

    const { body } = yield request(`http://${ip}:7000/current?path=//Controller//DataItem[@type="LOGIC_PROGRAM"]`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children
    
    assert(children.length === 1)
    assert(children[0].name === 'Normal' && children[0].attributes.nativeCode === undefined)
    done()
  })
})

describe('Unavailable for condition dataITems', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('returns 3 dataItems clp', () => {
    const id = lokijs.getDataItem(uuid, 'clp').$.id
    const arr = ['TIME|clp|FAULT|2218|ALARM_B|HIGH|2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF', 'TIME|clp|FAULT|4200|ALARM_D||4200 ALARM_D Power on effective parameter set', 'TIME|clp|WARNING|3600|ALARM_C||3600 ALARM_C Power on effective parameter set']
    R.map((str) => {
      common.parsing(str, uuid)
    }, arr)

    const map = dataStorage.hashCondition.get(id)
    const items = Array.from(map.values())
    assert(items.length === 3)
    assert(items[0].value[0] === 'FAULT' && items[1].value[0] === 'FAULT' && items[2].value[0] === 'WARNING')
  })
  
  it('clears all warnings and faults and only return Unavailable', function*(done){
    common.parsing('TIME|clp|UNAVAILABLE||||', uuid)
    const sequence = dataStorage.getSequence()
    const lastSequence = sequence.lastSequence

    const { body } = yield request(`http://${ip}:7000/current?path=//Controller//DataItem[@type="LOGIC_PROGRAM"]&at=${lastSequence}`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children
    
    assert(children.length === 1)
    assert(children[0].name === 'Unavailable' && children[0].attributes.nativeCode === undefined)
    done()
  })
})

describe.skip('extended schema', () => {
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/extension.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    config.get
    stub.restore()
  })

  it('getsDataItemExt()', function*(done){
    const latestSchema = lokijs.searchDeviceSchema('000')
    const device = latestSchema[0].device 
    const description = device.Description[0]._
    const components = device.Components[0]
    const keys = R.keys(components)
    
    assert(description === 'Extended Schema.')
    R.map((key) => {
      const [ prefixC, className ] = key.split(':')
      const component = components[key]
      assert(prefixC === 'x' && className === 'Pump' && component[0].$.name === 'pump')
      const dataItem = component[0].DataItems[0].DataItem[0]
      const str = dataStorage.pascalCase(dataItem.$.type)
      const [ prefixD, elementName ] = str.split(':')
      assert(prefixD === 'x' && elementName === 'Flow' && dataItem.$.type === 'x:FLOW') 
    }, keys)
    config.setConfiguration(device, 'AutoAvailable', false)
    done()
  })
})

describe('testBadDataItem()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('returns dataItem line as UNAVAILABLE', function*(done){
    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const line = root.children[1].children[0].children[6].children[1].children[2]

    assert(line.content === 'UNAVAILABLE')
    done()
  })

  it('ignores dataItems bad and dummy, updates only line', function*(done){
    const str = 'TIME|bad|ignore|dummy|1244|line|204'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[6].children[1].children
    const lines = []
    
    R.map((child) => {
      if(child.name === 'Line') lines.push(child)
    }, children)

    assert(lines.length === 2)
    assert(lines[0].content === 'UNAVAILABLE' && lines[1].content === '204')
    done()
  })
})

describe('testConstantValue()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('returns UNAVAILABLE for dataItem block', function*(done){
    const dataItem = lokijs.getDataItem(uuid, 'block')
    dataItemjs.addConstrainedValue(dataItem, 'UNAVAILABLE')

    const { body } = yield request(`http://${ip}:7000/sample`)  
    const obj = parse(body)
    const { root } = obj
    const block = root.children[1].children[0].children[6].children[1].children[0]

    assert(block.content === 'UNAVAILABLE')
    assert(dataItem.$.name === 'block')
    assert(dataItem.Constraints[0].Value[0] === 'UNAVAILABLE')
    done()
  })

  it('should not update value for block', function*(done){
    const str = 'TIME|block|G01X00|Cmode|INDEX|line|204'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const rotaryMode = root.children[1].children[0].children[1].children[1].children
    const compPath = root.children[1].children[0].children[6].children[1].children
    const block = []
    const line = []
    
    R.map((item) => {
      if(item.name === 'Block') block.push(item)
      if(item.name === 'Line')line.push(item)
    }, compPath)

    assert(rotaryMode[0].content === 'SPINDLE' && rotaryMode.length === 1)
    assert(block[0].content === 'UNAVAILABLE' && block.length === 1)
    assert(line.length === 2)
    done()
  })
})

describe('testFilterValue()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/filter_example.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('returns Load as UNAVAILABLE', function*(done){
    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const load = root.children[1].children[0].children[1].children[0].children[0]
    
    assert(load.content === 'UNAVAILABLE') 
    done()
  })

  it('adds new entry for load', function*(done){
    const str = 'TIME|load|100'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[1].children[0].children
    const load = R.filter(child => child.name === 'Load', children)
    
    assert(load.length === 2)
    assert(load[0].content === 'UNAVAILABLE' && load[1].content === '100')
    done()
  })

  it('adds only one entry "TIME|load|106"', function*(done){
    const arr = ['TIME|load|103', 'TIME|load|106']
    R.map((str) => {
      common.parsing(str, uuid)
    }, arr)
    
    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[1].children[0].children
    const load = R.filter(child => child.name === 'Load', children)

    assert(load.length === 3)
    assert(load[0].content === 'UNAVAILABLE' && load[1].content === '100' && load[2].content === '106')
    done()
  })

  it('ignores dups and insert only last entry', function*(done){
    const str = 'TIME|load|106|load|108|load|112'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[1].children[0].children
    const load = R.filter(child => child.name === 'Load', children)
    
    assert(load.length === 4)
    assert(load[0].content === 'UNAVAILABLE' && load[1].content === '100' && 
          load[2].content === '106' && load[3].content === '112')
    done()
  })

  it('returns filter type', () => {
    const dataItem = lokijs.getDataItem(uuid, 'pos')
    const type = dataItemjs.getFilterType(dataItem)
    const filterValue = dataItemjs.getFilterValue(dataItem.Constraints)

    assert(type === 'MINIMUM_DELTA')
    assert('0' === dataItemjs.filterValue(filterValue, 0.0, 'UNAVAILABLE'))
    assert(dataItemjs.filterValue(filterValue, 5.0, '0') === '0')
    assert(dataItemjs.filterValue(filterValue, 20.0, '0') === '20')
  })
})

describe('testDynamicCalibration()', () => {
  const uuid = '3f707e77-7b44-55a0-9aba-2a671d5e7089'
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/alarm.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('check if ConversionFactor and ConversionOffset are set',  () => {
    const str3 = '* calibration:Yact|.01|200.0|Zact|0.02|300|Xact|0.01|500'
    common.protocolCommand(str3, uuid)

    const dataItem1 = lokijs.getDataItem(uuid, 'Yact')
    const dataItem2 = lokijs.getDataItem(uuid, 'Zact')
    
    assert(Number(dataItem1.ConversionFactor) === 0.01)
    assert(Number(dataItem1.ConversionOffset) === 200.0)
    assert(Number(dataItem2.ConversionFactor) === 0.02)
    assert(Number(dataItem2.ConversionOffset) === 300.0)
  })

  it('returns calibrated values', function*(done){
    const arr = ['TIME|Xact|25|| 5118 5118 5118 5118 5118 5118 5118 5118 5118 5118 5118 5118 5119 5119 5118 5118 5117 5117 5119 5119 5118 5118 5118 5118 5118', 'TIME|Yact|200|Zact|600']
    R.map((str) => {
      common.parsing(str, uuid)
    }, arr)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const xact = root.children[1].children[0].children[2].children[0].children[0] 
    const yact = root.children[1].children[0].children[3].children[0].children[0]
    const zact = root.children[1].children[0].children[4].children[0].children[0]
    
    assert(xact.content === '56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.19 56.19 56.18 56.18 56.17 56.17 56.19 56.19 56.18 56.18 56.18 56.18 56.18')
    assert(yact.content === '4' && zact.content === '18')
    done()
  })
})

describe.skip('testUUIDChange()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const device = {
    address: '10.0.0.193',
    ip: '7879',
    uuid
  }
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.hashDataItems.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    devices.insert(device)
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    devices.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.hashDataItems.clear()
    stub.restore()
  })

  it('set PreserveUuid to false', () => {
    const device = lokijs.searchDeviceSchema(uuid)[0].device
    dataStorage.setConfiguration(device, 'PreserveUuid', false)
    assert(dataStorage.getConfiguredVal(device.$.name, 'PreserveUuid') === false)
  })

  it('updates devices attributes', function*(done){
    const str = '* uuid: MK-1234'
    const str1 = '* manufacturer: Big Tool'
    const str2 = '* serialNumber: XXXX-1234'
    const str3 = '* station: YYYY'

    common.protocolCommand(str, uuid)
    common.protocolCommand(str1, 'MK-1234')
    common.protocolCommand(str2, 'MK-1234')
    common.protocolCommand(str3, 'MK-1234')
    
    const { body } = yield request(`http://${ip}:7000/probe`)
    const obj = parse(body)
    const { root } = obj
    const device = root.children[1].children[0]
    const description = root.children[1].children[0].children[0]
    
    assert(device.attributes.uuid === 'MK-1234')
    assert(description.attributes.manufacturer === 'Big Tool')
    assert(description.attributes.serialNumber === 'XXXX-1234')
    assert(description.attributes.station === 'YYYY')
    done()
  })
  
  it('renders device with new uuid', function*(done){
    const path = 'path=//Device[@uuid="MK-1234"]'
    const { body } = yield request(`http://${ip}:7000/sample?${path}`)
    const obj = parse(body)
    const { root } = obj
    const device = root.children[1].children
    
    assert(device.length === 1 && device[0].attributes.uuid === 'MK-1234')
    done()
  })

  it('keeps uuid the same if PreserveUuid is true', function*(done){
    const str = '* uuid: XXXXXXX'
    const device = lokijs.searchDeviceSchema('MK-1234')[0].device
    dataStorage.setConfiguration(device, 'PreserveUuid', true)
    common.protocolCommand(str, 'MK-1234')
    
    const { body } = yield request(`http://${ip}:7000/probe`)
    const obj = parse(body)
    const { root } = obj
    const dev = root.children[1].children[0]
    
    assert(dev.attributes.uuid === 'MK-1234')
    done()
  })
})

describe('testRelativeTime()', () => {
  let stub
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const time = moment().valueOf()
  const offset = 1000
  
  before(function *() {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('sets BaseTime and BaseOffset along with RelativeTime', () => {
    const device = lokijs.searchDeviceSchema(uuid)[0].device
    dataStorage.setConfiguration(device, 'RelativeTime', true)
    dataStorage.setConfiguration(device, 'BaseTime', time)
    dataStorage.setConfiguration(device, 'BaseOffset', 1000)
    
    assert(dataStorage.getConfiguredVal(device.$.name, 'RelativeTime') === true)
    assert(dataStorage.getConfiguredVal(device.$.name, 'BaseTime') === time)
    assert(dataStorage.getConfiguredVal(device.$.name, 'BaseOffset') === 1000)
  })

  it('Adds a 10.654321 seconds', function*(done){
    const str = '11654|line|204'
    common.parsing(str, uuid) 
    
    const { body } = yield request(`http://${ip }:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[6].children[1].children
    const lines = R.filter(child => child.name === 'Line', children)

    assert(lines.length === 2)
    assert(lines[0].content === 'UNAVAILABLE')
    assert(lines[1].content === '204')
    assert(moment(time + (11654 - offset)).toISOString() === lines[1].attributes.timestamp)
    assert(11654 - offset === 10654)
    done()
  })

  it('sets RelativeTime back to false', () => {
    const device = lokijs.searchDeviceSchema(uuid)[0].device
    dataStorage.setConfiguration(device, 'RelativeTime', false)
    dataStorage.setConfiguration(device, 'BaseTime', 0)
    dataStorage.setConfiguration(device, 'BaseOffset', 0)

    assert(dataStorage.getConfiguredVal(device.$.name, 'RelativeTime') === false)
    assert(dataStorage.getConfiguredVal(device.$.name, 'BaseTime') === 0)
    assert(dataStorage.getConfiguredVal(device.$.name, 'BaseOffset') === 0)
  })
})

describe('testRelativeParsedTime()', () => {
  let stub, device
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const time1 = moment().valueOf()
  const time2 = moment().valueOf() - 120000
  const time = time1 + 10111
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('sets RelativeTime to true', () => {
    device = lokijs.searchDeviceSchema(uuid)[0].device
    dataStorage.setConfiguration(device, 'RelativeTime', true)
    dataStorage.setConfiguration(device, 'BaseTime', time2)
    dataStorage.setConfiguration(device, 'BaseOffset', time1)
    dataStorage.setConfiguration(device, 'ParseTime', true)

    assert(dataStorage.getConfiguredVal(device.$.name, 'RelativeTime') === true)
    assert(dataStorage.getConfiguredVal(device.$.name, 'BaseTime') === time2)
    assert(dataStorage.getConfiguredVal(device.$.name, 'BaseOffset') === time1)
    assert(dataStorage.getConfiguredVal(device.$.name, 'ParseTime') === true)
  })

  it('Add a 10.111000 seconds', function*(done){
    const str = `${moment(time).toISOString()}|line|100`
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[6].children[1].children
    const lines = R.filter(child => child.name === 'Line', children)

    assert(lines.length === 2)
    assert(lines[0].content === 'UNAVAILABLE')
    assert(lines[1].content === '100')
    assert(moment(time2 + (time - time1)).toISOString() === lines[1].attributes.timestamp)
    assert(time - time1 === 10111)
    done()
  })

  it('sets RelativeTime back to false', () => {
    dataStorage.setConfiguration(device, 'RelativeTime', false)
    dataStorage.setConfiguration(device, 'BaseTime', 0)
    dataStorage.setConfiguration(device, 'BaseOffset', 0)
    dataStorage.setConfiguration(device, 'ParseTime', false)

    assert(dataStorage.getConfiguredVal(device.$.name, 'RelativeTime') === false)
    assert(dataStorage.getConfiguredVal(device.$.name, 'BaseTime') === 0)
    assert(dataStorage.getConfiguredVal(device.$.name, 'BaseOffset') === 0)
    assert(dataStorage.getConfiguredVal(device.$.name, 'ParseTime') === false)
  })
})

describe('testRelativeParsedTimeDetection()', () => {
  let stub, device
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'

  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('sets RelativeTime to true', () => {
    device = lokijs.searchDeviceSchema(uuid)[0].device
    dataStorage.setConfiguration(device, 'RelativeTime', true)
    dataStorage.setConfiguration(device, 'ParseTime', true)

    assert(dataStorage.getConfiguredVal(device.$.name, 'RelativeTime') === true)
    assert(dataStorage.getConfiguredVal(device.$.name, 'ParseTime') === true)
  })

  it('sets BaseOffset to 1354194086555', () => {
    const str = '2012-11-29T05:01:26.555666|line|100'
    common.parsing(str, uuid)

    assert(1354194086555 === dataStorage.getConfiguredVal(device.$.name, 'BaseOffset'))
  })

  it('sets RelativeTime back to false and BaseOffset and BaseTime to 0', () => {
    dataStorage.setConfiguration(device, 'RelativeTime', false)
    dataStorage.setConfiguration(device, 'BaseOffset', 0)
    dataStorage.setConfiguration(device, 'BaseTime', 0)
    dataStorage.setConfiguration(device, 'ParseTime', false)

    assert(dataStorage.getConfiguredVal(device.$.name, 'RelativeTime') === false)
    assert(dataStorage.getConfiguredVal(device.$.name, 'ParseTime') === false)
    assert(dataStorage.getConfiguredVal(device.$.name, 'BaseTime') === 0)
    assert(dataStorage.getConfiguredVal(device.$.name, 'BaseOffset') === 0)
  })
})

describe('testRelativeOffsetDetection()', () => {
  let stub, device
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'

  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('sets RelativeTime to true', () => {
    device = lokijs.searchDeviceSchema(uuid)[0].device
    dataStorage.setConfiguration(device, 'RelativeTime', true)

    assert(dataStorage.getConfiguredVal(device.$.name, 'RelativeTime') === true)
    assert(dataStorage.getConfiguredVal(device.$.name, 'ParseTime') === false)
  })

  it('sets BaseOffset to 1234556', () => {
    const str = '1234556|line|100'
    common.parsing(str, uuid)

    assert(1234556 === dataStorage.getConfiguredVal(device.$.name, 'BaseOffset'))
  })

  it('sets RelativeTime, BaseOffset and BaseTime to original values', () => {
    dataStorage.setConfiguration(device, 'RelativeTime', false)
    dataStorage.setConfiguration(device, 'BaseOffset', 0)
    dataStorage.setConfiguration(device, 'BaseTime', 0)

    assert(dataStorage.getConfiguredVal(device.$.name, 'RelativeTime') === false)
    assert(dataStorage.getConfiguredVal(device.$.name, 'BaseOffset') === 0)
    assert(dataStorage.getConfiguredVal(device.$.name, 'BaseTime') === 0)
    assert(dataStorage.getConfiguredVal(device.$.name, 'ParseTime') === false)
  })
})

describe('testDuplicateCheckAfterDisconnect()', () => {
  let stub, device
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const device1 = {
    address: '10.0.0.193',
    ip: '7879',
    uuid
  }
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    devices.insert(device1)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    devices.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('makes sure FilterDuplicates is set to true', () => {
    device = lokijs.searchDeviceSchema(uuid)[0].device
    dataStorage.setConfiguration(device, 'FilterDuplicates', true)

    assert(dataStorage.getConfiguredVal(device.$.name, 'FilterDuplicates') === true)
  })

  it('checks for dups', function*(done){
    const strs = ['TIME|line|204', 'TIME|line|204', 'TIME|line|205']
    R.map((str) => {
      common.parsing(str, uuid)
    }, strs)
    
    const { body } = yield request(`http://${ip}:7000/sample?path=//Path//DataItem[@type="LINE"]`)
    const obj = parse(body)
    const { root } = obj
    const lines = root.children[1].children[0].children[0].children[0].children
    
    assert(lines.length === 3)
    assert(lines[0].content === 'UNAVAILABLE' && lines[1].content === '204' && lines[2].content === '205')
    done()
  })

  it('on remove device should add new entry for Line with value UNAVAILABLE', function*(done){
    devices.findAndRemove({ uuid })

    const { body } = yield request(`http://${ip}:7000/sample?path=//Path//DataItem[@type="LINE"]`)
    const obj = parse(body)
    const { root } = obj
    const lines = root.children[1].children[0].children[0].children[0].children 
    
    assert(lines.length === 4)
    assert(lines[0].content === 'UNAVAILABLE' && lines[1].content === '204' && 
          lines[2].content === '205' && lines[3].content === 'UNAVAILABLE')
    done()
  })

  it('should insert new value after reconnect', function*(done){
    devices.insert(device1)
    const str = 'TIME|line|205'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/sample?path=//Path//DataItem[@type="LINE"]`)
    const obj = parse(body)
    const { root } = obj
    const lines = root.children[1].children[0].children[0].children[0].children 
    
    assert(lines.length === 5)
    assert(lines[0].content === 'UNAVAILABLE' && lines[1].content === '204' && 
          lines[2].content === '205' && lines[3].content === 'UNAVAILABLE' &&
          lines[4].content === '205')
    done()
  })
})

describe('testAutoAvailable()', () => {
  let xml
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const device = {
    address: '10.0.0.193',
    ip: '7879',
    uuid
  }
  const deviceForConfig = {
    '$': { id: 'dev', iso841Class: '6', name: 'VMC-3Axis', uuid: '000' }
  }

  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    lokijs.setDefaultConfigsForDevice('VMC-3Axis')
    xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    dataStorage.setConfiguration(deviceForConfig, 'AutoAvailable', true)
    lokijs.updateSchemaCollection(xml)
    devices.insert(device)
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    devices.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
  })

  it('when AutoAvailable is true returns AVAILABLE', function*(done){
    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const avail = root.children[1].children[0].children[0].children[0].children[0]
    
    assert(avail.content === 'AVAILABLE')
    done()
  })

  it('when devices disconnect should return Availability UNAVAILABLE', function*(done){
    devices.findAndRemove({ uuid })
    
    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children
    const avail = R.filter(child => child.name === 'Availability', children)
    
    assert(avail.length === 2)
    assert(avail[0].content === 'AVAILABLE' && avail[1].content === 'UNAVAILABLE')
    done()
  })

  it('when reconnect sets Availability to AVAILABLE', function*(done){
    devices.insert(device)
    lokijs.updateSchemaCollection(xml)

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children
    const avail = R.filter(child => child.name === 'Availability', children)
    
    assert(avail.length === 3)
    assert(avail[0].content === 'AVAILABLE' && 
          avail[1].content === 'UNAVAILABLE' && 
          avail[2].content === 'AVAILABLE')
    done()
  })

  it('when devices disconnect should return Availability UNAVAILABLE', function*(done){
    devices.findAndRemove({ uuid })
    
    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children
    const avail = R.filter(child => child.name === 'Availability', children)
    
    assert(avail.length === 4)
    assert(avail[0].content === 'AVAILABLE' && avail[1].content === 'UNAVAILABLE' &&
          avail[2].content === 'AVAILABLE' && avail[3].content === 'UNAVAILABLE')
    done()
  })
})

describe('testMultipleDisconnect()', () => {
  let xml
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const device = {
    address: '10.0.0.193',
    ip: '7879',
    uuid
  }
  const deviceForConfig = {
    '$': { id: 'dev', iso841Class: '6', name: 'VMC-3Axis', uuid }
  }

  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    devices.insert(device)
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    devices.clear()
    dataStorage.hashAdapters.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
  })

  it('returns one block and one MOTION_PROGRAM on /sample', function*(done){
    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const controller = root.children[1].children[0].children[5].children[1].children
    const compPath = root.children[1].children[0].children[6].children[1].children
    const block = R.filter(item => item.name === 'Block', compPath)
    const cmp = R.filter(item => item.attributes.type === 'MOTION_PROGRAM', controller)
    
    assert(block.length === 1 && cmp.length === 1 && block[0].content === 'UNAVAILABLE')
    done()
  })

  it('updates block element and element type MOTION_PROGRAM', function*(done){
    const strs = ['TIME|block|GTH', 'TIME|motion|normal||||']
    R.map((str) => {
      common.parsing(str, uuid)
    }, strs)

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const controller = root.children[1].children[0].children[5].children[1].children
    const compPath = root.children[1].children[0].children[6].children[1].children
    const block = R.filter(item => item.name === 'Block', compPath)
    const cmp = R.filter(item => item.attributes.type === 'MOTION_PROGRAM', controller)
    
    assert(block.length === 2 && cmp.length === 2)
    assert(block[0].content === 'UNAVAILABLE' && block[1].content === 'GTH')
    assert(cmp[0].name === 'Unavailable' && cmp[1].name === 'Normal')
    done()
  })

  it('on disconnect all elements UNAVAILABLE', function*(done){
    devices.findAndRemove({ uuid })

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const controller = root.children[1].children[0].children[5].children[1].children
    const compPath = root.children[1].children[0].children[6].children[1].children
    const block = R.filter(item => item.name === 'Block', compPath)
    const cmp = R.filter(item => item.attributes.type === 'MOTION_PROGRAM', controller)
    const cmpUnavail = R.filter(item => item.name === 'Unavailable', cmp)
    const cmpNorm = R.filter(item => item.name === 'Normal', cmp)
    
    assert(block.length === 3 && cmp.length === 3 && cmpUnavail.length === 2 && cmpNorm.length === 1)
    assert(block[1].content === 'GTH' && block[2].content === 'UNAVAILABLE')

    done()
  })

  it('on second disconnect everything should stay the same', function*(done){
    devices.findAndRemove({ uuid })

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const controller = root.children[1].children[0].children[5].children[1].children
    const compPath = root.children[1].children[0].children[6].children[1].children
    const block = R.filter(item => item.name === 'Block', compPath)
    const cmp = R.filter(item => item.attributes.type === 'MOTION_PROGRAM', controller)
    const cmpUnavail = R.filter(item => item.name === 'Unavailable', cmp)
    const cmpNorm = R.filter(item => item.name === 'Normal', cmp)
    
    assert(block.length === 3 && cmp.length === 3 && cmpUnavail.length === 2 && cmpNorm.length === 1)
    assert(block[1].content === 'GTH' && block[2].content === 'UNAVAILABLE')

    done()
  })

  it('on reconnect updates values and add device to Db', () => {
    devices.insert(device)
    const strs = ['TIME|block|GTH', 'TIME|motion|normal||||']
    R.map((str) => {
      common.parsing(str, uuid)
    }, strs)
    
    assert(devices.count() === 1)
  })

  it('on disconnect set values to UNAVAILABLE', function*(done){
    devices.findAndRemove({ uuid })

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const controller = root.children[1].children[0].children[5].children[1].children
    const compPath = root.children[1].children[0].children[6].children[1].children
    const block = R.filter(item => item.name === 'Block', compPath)
    const cmp = R.filter(item => item.attributes.type === 'MOTION_PROGRAM', controller)
    const cmpUnavail = R.filter(item => item.name === 'Unavailable', cmp)
    const cmpNorm = R.filter(item => item.name === 'Normal', cmp)
    
    assert(block.length === 5 && cmp.length === 5 && cmpUnavail.length === 3 && cmpNorm.length === 2)
    done()
  })
})

describe('test_config.xml', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub

  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/test_config.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([ uuid ])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })
  // rewrite 
  it('renders everything correctly', function*(done){
    const { body } = yield request(`http://${ip}:7000/current`) 
    //console.log(body)
    done()
  })
  it('adds duration if statistic present and value is not UNAVAILABLE', function*(done){
    const str = '2011-02-18T15:52:41Z@200.1232|Xact|60'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[2].children[0].children
    const xact = R.filter(child => child.attributes.name === 'Xact', children)
    
    assert(xact.length === 2)
    assert(xact[0].content === 'UNAVAILABLE' && xact[0].attributes.statistic === 'AVERAGE' && xact[0].attributes.duration === undefined)
    assert(xact[1].content === '60' && xact[1].attributes.statistic === 'AVERAGE' && xact[1].attributes.duration === '200.1232')
    done()
  })

  it('find dataItem by Source', function * (done) {
    const str = '|SspeedOvr|100'
    const id = lokijs.getDataItem(uuid, 'SspeedOvr').$.id    
    common.parsing(str, uuid )

    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const sSpeedOvr = root.children[1].children[0].children[1].children[0].children[1]

    assert(sSpeedOvr.name === 'SpindleSpeed' && sSpeedOvr.attributes.dataItemId === id && sSpeedOvr.content === '100')
    done()
  })

  it('renders only Linear name Z on request', function*(done){
    const { body } = yield request(`http://${ip}:7000/current?path=//Linear[@name="Z"]`)
    const obj = parse(body)
    const { root } = obj
    const linear = root.children[1].children[0].children[0]
    const sample = linear.children[0].children
    const condition = linear.children[1].children
    
    assert(linear.attributes.component === 'Linear' && linear.attributes.name === 'Z')
    assert(sample.length === 2 && condition.length === 1)
    done()
  })

  it('renders only sample data items on request', function*(done){
    const { body } = yield request(`http://${ip}:7000/current?path=//Linear[@name="Z"]//DataItem[@category="SAMPLE"]`)
    const obj = parse(body)
    const { root } = obj
    const linear = root.children[1].children[0].children[0]
    const sample = linear.children[0]
    
    assert(linear.attributes.component === 'Linear' && linear.attributes.name === 'Z')
    assert(sample.name === 'Samples' && sample.children.length === 2)
    done()
  })

  it('renders only dataItem with Xact name', function*(done){
    const { body } = yield request(`http://${ip}:7000/current?path=//DataItem[@name="Xact"]`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children
    
    assert(children.length === 1 && children[0].attributes.name === 'Xact')
    done()
  })

  it('renders dataItems category SAMPLE and CONDITION only for Linear[@name="x" and @name="Z"] on /current', function*(done){
    const { body } = yield request(`http://${ip}:7000/current?path=//Linear[@name="Z" and @name="X"]//DataItem[@category="SAMPLE" and @category="CONDITION"]`)
    const obj = parse(body)
    const { root } = obj
    const components = root.children[1].children[0].children
    const category1 = components[0].children
    const category2 = components[1].children

    assert(components.length === 2 && category1.length === 2 && category2.length === 2)
    assert(components[0].attributes.component === 'Linear' && components[0].attributes.name === 'X')
    assert(components[1].attributes.component === 'Linear' && components[1].attributes.name === 'Z')
    assert(category1[0].name === 'Samples' && category1[1].name === 'Condition')
    assert(category2[0].name === 'Samples' && category2[1].name === 'Condition')
    done()
  })

  it('renders dataItems category SAMPLE and CONDITION only for Linear[@name="x" and @name="Z"] on /sample', function*(done){
    const { body } = yield request(`http://${ip}:7000/sample?path=//Linear[@name="Z" and @name="X"]//DataItem[@category="SAMPLE" and @category="CONDITION"]`)
    const obj = parse(body)
    const { root } = obj
    const components = root.children[1].children[0].children
    const category1 = components[0].children
    const category2 = components[1].children

    assert(components.length === 2 && category1.length === 2 && category2.length === 2)
    assert(components[0].attributes.component === 'Linear' && components[0].attributes.name === 'X')
    assert(components[1].attributes.component === 'Linear' && components[1].attributes.name === 'Z')
    assert(category1[0].name === 'Samples' && category1[1].name === 'Condition')
    assert(category2[0].name === 'Samples' && category2[1].name === 'Condition')
    done()
  })

  it('renders dataItems category SAMPLE and CONDITION only for Linear[@name="x" and @name="Z"] on /current with at=', function*(done){
    const sequence = dataStorage.getSequence()
    const lastSequence = sequence.lastSequence
    const { body } = yield request(`http://${ip}:7000/current?path=//Linear[@name="X" and @name="Z"]//DataItem[@category="SAMPLE" and @category="CONDITION"]&at=${lastSequence}`)
    const obj = parse(body)
    const { root } = obj
    const components = root.children[1].children[0].children
    const category1 = components[0].children
    const category2 = components[1].children

    assert(components.length === 2 && category1.length === 2 && category2.length === 2)
    assert(components[0].attributes.component === 'Linear' && components[0].attributes.name === 'X')
    assert(components[1].attributes.component === 'Linear' && components[1].attributes.name === 'Z')
    assert(category1[0].name === 'Samples' && category1[1].name === 'Condition')
    assert(category2[0].name === 'Samples' && category2[1].name === 'Condition')
    done()
  })
})

describe.skip('two_devices.xml', () => {
  const uuid1 = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const uuid2 = '3f707e77-7b44-55a0-9aba-2a671d5e7089'
  const uuid = uuidv5(uuid1, uuid2)
  const devices2 = {
    address: '10.0.0.193',
    ip: '7879',
    uuid
  }
  const xml = fs.readFileSync('./test/support/two_devices.xml', 'utf8')

  let stub

  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.hashDataItems.clear()
    const jsonObj = xmlToJSON(xml)
    lokijs.updateSchemaCollection(jsonObj)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    devices.insert(devices2)
    stub.returns([uuid1, uuid2])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.hashDataItems.clear()
    stub.restore()
  })

  it('change serialNumber on device-1', function*(done){
    let uuid
    const str = '* device-1:serialNumber: XXXX-1234'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/probe`)
    const obj = parse(body)
    const { root } = obj
    const device1 = root.children[1].children[1].children[0]
    const device2 = root.children[1].children[0].children[0]

    assert(device1.attributes.serialNumber === 'XXXX-1234')
    assert(device2.attributes.serialNumber === '0')
    done()
  })

  it('change serialNumber for both devices', function*(done) {
    let uuid
    const str = '* device-1:serialNumber: XXXX-5678|device-2:serialNumber: XXXX-1234'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/probe`)
    const obj = parse(body)
    const { root } = obj
    const device1 = root.children[1].children[1].children[0]
    const device2 = root.children[1].children[0].children[0]

    assert(device1.attributes.serialNumber === 'XXXX-5678')
    assert(device2.attributes.serialNumber === 'XXXX-1234')
    done()
  })

  it('dynamicly calibrates both devices', function*(done){
    let uuid
    const str = '* device-1:calibration:Yact|.01|200.0|Zact|0.02|300|Xact|0.01|500|device-2:calibration:Yact|.02|400.0|Zact|0.02|300|Xact|0.01|500'
    common.parsing(str, uuid)
    
    const Yact1 = lokijs.findDataItem(uuid1, 'Yact')
    const Yact2 = lokijs.findDataItem(uuid2, 'Yact')

    assert(Number(Yact1.ConversionFactor) === 0.01)
    assert(Number(Yact1.ConversionOffset) === 200.0)
    assert(Number(Yact2.ConversionFactor) === 0.02)
    assert(Number(Yact2.ConversionOffset) === 400.0)
    done()
  })

  it('renders dataItems for both devices correctly', function*(done){
    let uuid
    const str = 'TIME|device-1:Xact|25|| 5118 5118 5118 5118 5118 5118 5118 5118 5118 5118 5118 5118 5119 5119 5118 5118 5117 5117 5119 5119 5118 5118 5118 5118 5118|device-1:Yact|200|device-1:Zact|600|device-2:Xact|25|| 5218 5218 5219|device-2:Yact|200|device-2:Zact|600'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const yact1 = root.children[1].children[0].children[2].children[0].children[0]
    const yact2 = root.children[1].children[1].children[2].children[0].children[0]
    const xact1 = root.children[1].children[0].children[1].children[0].children[0]
    const xact2 = root.children[1].children[1].children[1].children[0].children[0]
    const zact1 = root.children[1].children[0].children[3].children[0].children[0]
    const zact2 = root.children[1].children[1].children[3].children[0].children[0]

    assert(yact2.content === '4' && yact1.content === '12')
    assert(xact2.content === '56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.19 56.19 56.18 56.18 56.17 56.17 56.19 56.19 56.18 56.18 56.18 56.18 56.18')
    assert(xact1.content === '57.18 57.18 57.19')
    assert(zact1.content === '18' && zact2.content === '18')
    done()
  })

  it('changes manufacturer for both devices', function*(done) {
    let uuid
    const str = '* device-1:manufacturer: Big Tool|device-2:manufacturer: Small Tool'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/probe`)
    const obj = parse(body)
    const { root } = obj
    const device1 = root.children[1].children[0].children[0]
    const device2 = root.children[1].children[1].children[0]

    assert(device2.attributes.manufacturer === 'Big Tool')
    assert(device1.attributes.manufacturer === 'Small Tool')
    done()
  })

  it('changes station for both devices', function*(done){
    let uuid
    const str = '* device-1:station: YYYY|device-2:station: XXXX'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/probe`)
    const obj = parse(body)
    const { root } = obj
    const device1 = root.children[1].children[1].children[0]
    const device2 = root.children[1].children[0].children[0]

    assert(device2.attributes.station === 'XXXX' && device1.attributes.station === 'YYYY')
    done()
  })

  it('changes description for both devices', function*(done){
    let uuid
    const str = '* device-1:description: I am device-1|device-2:description: I am device-2'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/probe`)
    const obj = parse(body)
    const { root } = obj
    const desc1 = root.children[1].children[1].children[0]
    const desc2 = root.children[1].children[0].children[0]

    assert(desc1.content === 'I am device-1' && desc2.content === 'I am device-2')
    done()
  })

  it('changes conversionRequired for both devices', () => {
    let uuid
    const str = '* device-1:conversionRequired: true|device-2:conversionRequired: false'
    common.parsing(str, uuid) 

    const val1 = dataStorage.getConfiguredVal('device-1', 'ConversionRequired')
    const val2 = dataStorage.getConfiguredVal('device-2', 'ConversionRequired')
    
    assert(val1 === true && val2 === false)
  })

  it('changes relativeTime for both devices', () => {
    let uuid
    const str = '* device-1:relativeTime: true|device-2:relativeTime: false'
    common.parsing(str, uuid)

    const val1 = dataStorage.getConfiguredVal('device-1', 'RelativeTime')
    const val2 = dataStorage.getConfiguredVal('device-2', 'RelativeTime')
    
    assert(val1 === true && val2 === false)
  })

  it('on disconnect all dataItems UNAVAILABLE', function*(done) {
    devices.findAndRemove({ uuid })

    const { body } = yield request(`http://${ip}:7000/sample`)
    const obj = parse(body)
    const { root } = obj
    const device1 = root.children[1].children[1].children[1].children[0].children
    const device2 = root.children[1].children[0].children[1].children[0].children

    assert(device1.length === 3 && device2.length === 3)
    assert(device2[0].content === 'UNAVAILABLE' && device2[1].content === '57.18 57.18 57.19' && device2[2].content === 'UNAVAILABLE')
    assert(device1[0].content === 'UNAVAILABLE' && device1[1].content === '56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.18 56.19 56.19 56.18 56.18 56.17 56.17 56.19 56.19 56.18 56.18 56.18 56.18 56.18' 
            && device1[2].content === 'UNAVAILABLE')
    done()
  })

  it('changes autoAvailable for both devices', () => {
    let uuid
    const str = '* device-1:autoAvailable: true|device-2:autoAvailable: false'
    common.parsing(str, uuid)

    const val1 = dataStorage.getConfiguredVal('device-1', 'AutoAvailable')
    const val2 = dataStorage.getConfiguredVal('device-2', 'AutoAvailable')
    
    assert(val1 === true && val2 === false)
  })

  it('sets avail dataItem to AVAILABLE for device-1 on reconnect', function*(done){
    const jsonObj = xmlToJSON(xml)
    lokijs.updateSchemaCollection(jsonObj)
    devices.insert(devices2)

    const { body } = yield request(`http://${ip}:7000/sample?path=//DataItem[@name="d1-1"]`)
    const obj = parse(body)
    const { root } = obj
    const dataItems = root.children[1].children[0].children[0].children[0].children
    
    assert(dataItems.length === 2)
    assert(dataItems[0].content === 'UNAVAILABLE' && dataItems[1].content === 'AVAILABLE')
    done()
  })

  it('checks for dups after reconnect', function*(done){  
    const { body } = yield request(`http://${ip}:7000/sample?path=//DataItem[@name="d2-1"]`)
    const obj = parse(body)
    const { root } = obj
    const dataItems = root.children[1].children[0].children[0].children[0].children
    
    assert(dataItems.length === 1 && dataItems[0].content === 'UNAVAILABLE')
    done()
  })

  it('renders two devices', function*(done){
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const devices = root.children[1].children
    
    assert(devices.length === 2)
    assert(devices[0].attributes.uuid === uuid2 && devices[1].attributes.uuid === uuid1)
    done()
  })

  it('renders only one device if path=//Device[@uuid="${uuid1}"]', function*(done){
    const path = 'path=//Device[@uuid="${uuid1}"]'
    const { body } = yield request(`http://${ip}:7000/current?path=//Device[@uuid="${uuid1}"]`)
    const obj = parse(body)
    const { root } = obj
    const devices = root.children[1].children
    
    assert(devices.length === 1 && devices[0].attributes.uuid === uuid1)
    done()
  })

  it('renders only one device if path=//Device[@uuid="${uuid2}"] on /sample', function*(done){
    const path = 'path=//Device[@uuid="${uuid2}"]'
    const { body } = yield request(`http://${ip}:7000/sample?${path}`)
    const obj = parse(body)
    const { root } = obj
    const devices = root.children[1].children
    
    assert(devices.length === 1 && devices[0].attributes.uuid === uuid2)
    done()
  })

  it('updates dataItems', function*(done){
    let uuid
    const str = '2014-09-29T23:59:33.460470Z|device-1:exec|ACTIVE|device-2:exec|READY'
    common.parsing(str, uuid)

    const { body } = yield request(`http://${ip}:7000/sample?path=//DataItem[@name="exec"]`)
    const obj = parse(body)
    const { root } = obj
    const exec1 = root.children[1].children[0].children[0].children[0].children
    const exec2 = root.children[1].children[1].children[0].children[0].children
    
    assert(exec1.length === 2 && exec2.length === 2)
    assert(exec1[0].content === 'UNAVAILABLE' && exec1[1].content === 'READY')
    assert(exec2[0].content === 'UNAVAILABLE' && exec2[1].content === 'ACTIVE')
    done()
  })
})

describe('new device', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const obj = {
    IgnoreTimestamps: false,
    ConversionRequired: true,
    AutoAvailable: false,
    RelativeTime: false,
    FilterDuplicates: false,
    UpcaseDataItemValue: true,
    PreserveUuid: true,
    BaseTime: 0,
    BaseOffset: 0,
    ParseTime: false
  }
  
  let stub

  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    lokijs.setDefaultConfigsForDevice('lol')
    const xml = fs.readFileSync('./test/support/time_series.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('should add new device to hashAdapters', () => {
    assert(dataStorage.hashAdapters.has('lol') === true)
    assert.deepEqual(dataStorage.hashAdapters.get('lol'), obj)
  })

  it('should update parameter FilterDuplicates to device lol', () => {
    const str1 = '* filterDuplicates: true'
    
    common.protocolCommand(str1, uuid)

    assert(dataStorage.hashAdapters.get('lol').FilterDuplicates === true)
  })

  it('should update parameter IgnoreTimestamps to device lol', () => {
    const str2 = '* ignoreTimestamps: true'
    
    common.protocolCommand(str2, uuid)

    assert(dataStorage.hashAdapters.get('lol').IgnoreTimestamps === true)
  })

  it('should update parameter RelativeTime to device lol', () => {
    const str3 = '* relativeTime: true'
    common.protocolCommand(str3, uuid)

    assert(dataStorage.hashAdapters.get('lol').RelativeTime === true)
  })

  it('should update parameter ConversionRequired to device lol', () => {
    const str4 = '* conversionRequired: false'
    common.protocolCommand(str4, uuid)
    
    assert(dataStorage.hashAdapters.get('lol').ConversionRequired === false)
  })

  it('should update parameter PreserveUuid to device lol', () => {
    const str5 = '* preserveUuid: false'
    common.protocolCommand(str5, uuid)

    assert(dataStorage.hashAdapters.get('lol').PreserveUuid === false)
  })

  it('should update parameter AutoAvailable to device lol', () => {
    const str5 = '* autoAvailable: true'
    common.protocolCommand(str5, uuid)

    assert(dataStorage.hashAdapters.get('lol').AutoAvailable === true)
  })
})

describe('testResetTriggered()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub

  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const xml = fs.readFileSync('./test/support/test_config2.xml', 'utf8')
    lokijs.updateSchemaCollection(xml)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })

  it('should render xml correctly', function *(done) {
    const { body } = yield request(`http://${ip}:7000/current`)
    //console.log(body)
    done()
  })

  it('updates value of pcount on /sample', function * (done) {
    const strs = ['TIME1|pcount|0', 'TIME2|pcount|1', 'TIME3|pcount|2', 'TIME4|pcount|0:DAY', 'TIME3|pcount|5']
    R.map((str) => {
      common.parsing(str, uuid)
    }, strs)

    const { body } = yield request(`http://${ip}:7000/sample?path=//DataItem[@type="PART_COUNT"]`)
    const obj = parse(body)
    const { root } = obj
    const children = root.children[1].children[0].children[0].children[0].children

    assert(children.length === 6)
    assert(children[0].content === 'UNAVAILABLE' && children[1].content === '0')
    assert(children[2].content === '1' && children[3].content === '2')
    assert(children[4].content === '0' && children[4].attributes.resetTriggered === 'DAY')
    assert(children[5].content === '5')
    done()
  })

  it('updates value of pcount on /current', function * (done) {
    const strs = ['TIME1|pcount|0', 'TIME2|pcount|1', 'TIME3|pcount|2', 'TIME4|pcount|0:DAY']
     R.map((str) => {
      common.parsing(str, uuid)
    }, strs)

    const { body } = yield request(`http://${ip}:7000/current?path=//DataItem[@type="PART_COUNT"]`)
    const obj = parse(body)
    const { root } = obj
    const dataItem = root.children[1].children[0].children[0].children[0].children[0]
    assert(dataItem.name === 'PartCount' && dataItem.attributes.resetTriggered === 'DAY' && dataItem.content === '0')
    done()
  })
})

describe.skip('time for two devices from one adapter', () => {
  const xml = fs.readFileSync('./test/support/two_devices.xml', 'utf8')
  const devices2 = {
    address: '10.0.0.193',
    ip: '7879',
    uuid: 'device-1_device-2'
  }

  let stub, device1, device2

  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const jsonObj = xmlToJSON(xml)
    lokijs.updateSchemaCollection(jsonObj)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    devices.insert(devices2)
    stub.returns(['device-1', 'device-2'])
    device1 = lokijs.searchDeviceSchema('device-1')[0].device
    device2 = lokijs.searchDeviceSchema('device-2')[0].device
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    rawData.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    stub.restore()
  })
  
  describe('testRelativeTime()', () => {
    const time = moment().valueOf()
    const offset = 1000
    
    before(() => {
      dataStorage.setConfiguration(device1, 'BaseTime', time)
      dataStorage.setConfiguration(device1, 'BaseOffset', offset)
      dataStorage.setConfiguration(device1, 'ParseTime', false)
      dataStorage.setConfiguration(device2, 'BaseTime', 0)
      dataStorage.setConfiguration(device2, 'BaseOffset', 0)
      dataStorage.setConfiguration(device2, 'ParseTime', false)    
    })

    after(() => {
      dataStorage.setConfiguration(device1, 'BaseTime', 0)
      dataStorage.setConfiguration(device1, 'BaseOffset', 0)
      dataStorage.setConfiguration(device1, 'ParseTime', false)
      dataStorage.setConfiguration(device2, 'BaseTime', 0)
      dataStorage.setConfiguration(device2, 'BaseOffset', 0)
      dataStorage.setConfiguration(device2, 'ParseTime', false)  
    })

    it('set relativeTime to true for both devices', () => {
      let uuid
      const str = '* device-1:relativeTime: true|device-2:relativeTime: true'
      
      common.parsing(str, uuid)

      const val1 = dataStorage.getConfiguredVal('device-1', 'RelativeTime')
      const val2 = dataStorage.getConfiguredVal('device-2', 'RelativeTime')
      
      assert(val1 === true && val2 === true)
    })

    it('checks both devices for correct config', () => {
      assert(dataStorage.getConfiguredVal(device1.$.name, 'BaseTime') === time)
      assert(dataStorage.getConfiguredVal(device1.$.name, 'BaseOffset') === offset)
      assert(dataStorage.getConfiguredVal(device1.$.name, 'ParseTime') === false)
      assert(dataStorage.getConfiguredVal(device2.$.name, 'BaseTime') === 0)
      assert(dataStorage.getConfiguredVal(device2.$.name, 'BaseOffset') === 0)
    })

    it('Adds a 10.654321 seconds for device-1', function*(done){
      let uuid
      const str = '11654|device-1:mode|204|device-2:mode|206'

      common.parsing(str, uuid)

      const { body } = yield request(`http://${ip}:7000/current`)
      const obj = parse(body)
      const { root } = obj
      const device1 = root.children[1].children[1].children[4].children[0].children[0]
      const device2 = root.children[1].children[0].children[4].children[0].children[0]
      
      assert(moment(time + (11654 - offset)).toISOString() === device1.attributes.timestamp)
      assert(moment(time + (11654 - offset)).toISOString() !== device2.attributes.timestamp)
      done()
    })
  })
  
  describe('testRelativeParsedTime()', () => {
    const offset = 10111
    const time1 = moment().valueOf()
    const time2 = moment().valueOf() - 120000
    const time = time1 + offset

    before(() => {
      dataStorage.setConfiguration(device2, 'BaseTime', time2)
      dataStorage.setConfiguration(device2, 'BaseOffset', time1)
      dataStorage.setConfiguration(device2, 'ParseTime', true)
    })

    after(() => {
      dataStorage.setConfiguration(device2, 'BaseTime', 0)
      dataStorage.setConfiguration(device2, 'BaseOffset', 0)
      dataStorage.setConfiguration(device2, 'ParseTime', false)
      dataStorage.setConfiguration(device1, 'BaseTime', 0)
      dataStorage.setConfiguration(device1, 'BaseOffset', 0)
      dataStorage.setConfiguration(device1, 'ParseTime', false)
    })

    it('check if both devices are at correct config', () => {
      assert(dataStorage.getConfiguredVal(device2.$.name, 'ParseTime') === true && dataStorage.getConfiguredVal(device2.$.name, 'BaseOffset') === time1 && dataStorage.getConfiguredVal(device2.$.name, 'BaseTime') === time2)
      assert(dataStorage.getConfiguredVal(device1.$.name, 'ParseTime') === false && dataStorage.getConfiguredVal(device1.$.name, 'BaseOffset') === 0 && dataStorage.getConfiguredVal(device1.$.name, 'BaseTime') === 0)
      assert(dataStorage.getConfiguredVal('device-1', 'RelativeTime') === true && dataStorage.getConfiguredVal('device-2', 'RelativeTime') === true)
    })

    it('adds 10.111000 seconds for dataItem controllerMode to device-2', function*(done){
      let uuid
      const str = `${moment(time).toISOString()}|device-1:mode|400|device-2:mode|600`

      common.parsing(str, uuid)

      const { body } = yield request(`http://${ip}:7000/current`)
      const obj = parse(body)
      const { root } = obj
      const device_1 = root.children[1].children[1].children[4].children[0].children[0]
      const device_2= root.children[1].children[0].children[4].children[0].children[0]
      
      assert(moment(dataStorage.getConfiguredVal(device2.$.name, 'BaseTime') + offset).toISOString() === device_2.attributes.timestamp)
      assert(moment(dataStorage.getConfiguredVal(device1.$.name, 'BaseTime') + offset).toISOString() !== device_1.attributes.timestamp)
      done()
    })
  })

  describe('testRelativeParsedTimeDetection()', () => {
    const time = moment().valueOf()
    
    before(() => {
      dataStorage.setConfiguration(device1, 'ParseTime', true)
      dataStorage.setConfiguration(device2, 'BaseTime', time)
    })

    after(() => {
      dataStorage.setConfiguration(device1, 'ParseTime', false)
      dataStorage.setConfiguration(device1, 'BaseTime', 0)
      dataStorage.setConfiguration(device1, 'BaseOffset', 0)
      dataStorage.setConfiguration(device2, 'ParseTime', false)
      dataStorage.setConfiguration(device2, 'BaseTime', 0)
      dataStorage.setConfiguration(device2, 'BaseOffset', 0)
    })

    it('checks if both devices are at correct config', () => {
      assert(dataStorage.getConfiguredVal(device1.$.name, 'ParseTime') === true && dataStorage.getConfiguredVal(device2.$.name, 'ParseTime') === false)
      assert(dataStorage.getConfiguredVal(device1.$.name, 'BaseTime') === 0 && dataStorage.getConfiguredVal(device2.$.name, 'BaseTime') === time)
      assert(dataStorage.getConfiguredVal(device1.$.name, 'BaseOffset') === 0 && dataStorage.getConfiguredVal(device2.$.name, 'BaseOffset') === 0)
    })

    it('sets BaseOffset to 1354194086555', () => {
      const str = `2012-11-29T05:01:26.555666|device-1:mode|100|device-2:mode|200`

      common.parsing(str, '000')
      assert(1354194086555 === dataStorage.getConfiguredVal(device1.$.name, 'BaseOffset'))
      assert(0 === dataStorage.getConfiguredVal(device2.$.name, 'BaseOffset'))
    })
  })
  
  describe('testRelativeOffsetDetection()', () => {
    const time = moment().valueOf()

    before(() => {
      dataStorage.setConfiguration(device1, 'BaseTime', time)
    })

    after(() => {
      dataStorage.setConfiguration(device1, 'ParseTime', false)
      dataStorage.setConfiguration(device1, 'BaseTime', 0)
      dataStorage.setConfiguration(device1, 'BaseOffset', 0)
      dataStorage.setConfiguration(device2, 'ParseTime', false)
      dataStorage.setConfiguration(device2, 'BaseTime', 0)
      dataStorage.setConfiguration(device2, 'BaseOffset', 0)
    })

    it('checks if both devices are at correct config', () => {
      assert(dataStorage.getConfiguredVal(device1.$.name, 'ParseTime') === false)
      assert(dataStorage.getConfiguredVal(device2.$.name, 'ParseTime') === false)
      assert(dataStorage.getConfiguredVal(device1.$.name, 'BaseTime') === time)
      assert(dataStorage.getConfiguredVal(device2.$.name, 'BaseTime') === 0)
    })

    it('sets BaseOffset to 1234556', () => {
      const str = '1234556|device-1:mode|200|device-2:mode|300'
      
      common.parsing(str, '000')
    
      assert(1234556 === dataStorage.getConfiguredVal(device2.$.name, 'BaseOffset'))
      assert(0 === dataStorage.getConfiguredVal(device1.$.name, 'BaseOffset'))
    })
  })
})