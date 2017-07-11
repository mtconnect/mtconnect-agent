const ip = require('ip').address();
const assert = require('assert');
const fs = require('fs');
const sinon = require('sinon');
const request = require('co-request');
const parse = require('xml-parser');
const expect = require('expect.js');
const R = require('ramda');

// Imports - Internal
const lokijs = require('../src/lokijs')
const dataItemjs = require('../src/dataItem')
const dataStorage = require('../src/dataStorage')
const config = require('../src/config/config');
const adapter = require('../src/simulator/adapter');
const device = require('../src/simulator/device');
const fileServer = require('../src/simulator/fileserver');
const { filePort, machinePort } = config.app.simulator;
const { start, stop } = require('../src/agent');
const xmlToJSON = require('../src/xmlToJSON');
const common = require('../src/common');
const componentjs = require('../src/utils/component')

//constants
const schemaPtr = lokijs.getSchemaDB()
const cbPtr = dataStorage.circularBuffer
const bufferSize = config.app.agent.bufferSize
const rawData = lokijs.getRawDataDB()

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
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
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
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
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
})

describe('testAssetError()', () => {
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
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

  before(() => {
    schemaPtr.clear()
    dataStorage.assetBuffer.size = 4
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
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
    const jsonObj = common.inputParsing(str, '000')
    lokijs.dataCollectionUpdate(jsonObj, '000')

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
  before(() => {
    schemaPtr.clear()
    dataStorage.assetBuffer.size = 4
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
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

  it('it should accept multiline assets', () => {
    const json = common.inputParsing(newAsset, '000')
    lokijs.dataCollectionUpdate(json, '000')

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
    assert(parent.deviceUuid === '000')
    assert(parent.timestamp === 'TIME')
    done()
  })

  it('Make sure we can still add a line and we are out of multiline mode...', function*(done){
    const json = common.inputParsing(update, '000')
    lokijs.dataCollectionUpdate(json, '000')

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
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
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

  //does not work
  it('returns assetCount=2 on /probe', function*(done){
    const { body } = yield request(`http://${ip}:7000/probe`)

    const obj = parse(body)
    const { root } = obj
    //console.log(root.children)
    done()
  }) 
})

describe('testAssetRemoval', () => {
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
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
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
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
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

    const jsonObj = common.inputParsing(str, '000')
    lokijs.dataCollectionUpdate(jsonObj, '000')
    assert(dataStorage.assetBuffer.length === 1)

    const jsonObj2 = common.inputParsing(str2, '000')
    lokijs.dataCollectionUpdate(jsonObj2, '000')
    assert(dataStorage.assetBuffer.length === 2)

    const jsonObj3 = common.inputParsing(str3, '000')
    lokijs.dataCollectionUpdate(jsonObj3, '000')
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
    const jsonObj = common.inputParsing(str, '000')
    lokijs.dataCollectionUpdate(jsonObj, '000')

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
  before(() => {
    schemaPtr.clear()
    dataStorage.assetBuffer.size = 4
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
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
describe('testPutBlocking()', () => {
  let stub
  
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
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
    console.log(body)
    done()
  })
})

describe('testingPUT and updateAssetCollection()', () => {
  let stub
  
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
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

describe.skip('testAutoAvailable()', () => {
  let stub
  let stub2
  const device = {
    $: {
      id: 'dev000',
      name: 'VMC-3Axis'
    }
  }
  
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashLast.clear()
    stub2 = sinon.stub(config, 'getConfiguredVal')
    stub2.withArgs(device.$.name, 'AutoAvailable').returns(true)
    const xml = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
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
    stub2.restore()
  })

  it('returns event Availability as UNAVAILABLE', function*(done){
    const { body } = yield request(`http://${ip}:7000/assets`)
    const obj = parse(body)
    const { root } = obj
    //const avail = root.children[1].children[0].children[0].children[0].children[0]
    //console.log(body)
    
    //assert(avail.name === 'Availability')
    //assert(avail.content === 'UNAVAILABLE')

    done()
  })  
})

describe('working with 2 adapters', () => {
  let stub
  
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    const jsonFile1 = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile1))
    const jsonFile2 = fs.readFileSync('./test/support/VMC-4Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile2))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000', '111'])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })

  it('stores 2 schemas', () => {
    assert(schemaPtr.data.length === 2)
  })

  it('should update only one dataItem', function*(done) {
    const str = '2016-07-25T05:50:22.303002Z|c2|200'
    const jsonObj = common.inputParsing(str, '000')
    lokijs.dataCollectionUpdate(jsonObj, '000')
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const dataItem111 = root.children[1].children[0].children[1].children[0].children[0]
    const dataItem000 = root.children[1].children[1].children[1].children[0].children[0]
    
    assert(dataItem000 !== dataItem111)
    assert(dataItem000.content === '200')
    assert(dataItem111.content === 'UNAVAILABLE')
    done()
  })
})

describe('testDiscrete()', () => {
  let stub
  
  before(() => {
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/descrete_example.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(['000'])
    start()
  })

  after(() => {
    stop()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    stub.restore()
  })

  it('returns dataItem id=d_msg', () => {
    const dataItem = lokijs.getDataItemForId('d_msg', '000')

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
    const jsonObj1 = common.inputParsing('TIME|line|204', '000')
    lokijs.dataCollectionUpdate(jsonObj1, '000')
    const jsonObj2 = common.inputParsing('TIME|line|204', '000')
    lokijs.dataCollectionUpdate(jsonObj2, '000')
    const jsonObj3 = common.inputParsing('TIME|line|205', '000')
    lokijs.dataCollectionUpdate(jsonObj3, '000')

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
    const jsonObj1 = common.inputParsing('TIME|message|Hi|Hello', '000')
    lokijs.dataCollectionUpdate(jsonObj1, '000')
    const jsonObj2 = common.inputParsing('TIME|message|Hi|Hello', '000')
    lokijs.dataCollectionUpdate(jsonObj2, '000')
    const jsonObj3 = common.inputParsing('TIME|message|Hi|Hello', '000')
    lokijs.dataCollectionUpdate(jsonObj3, '000')

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
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
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
    stub.restore()
  })

  it('returns dataItem with id="dev_clg"',function*(done){
    const dataItem = lokijs.getDataItemForId('dev_clp', '000')
    assert(dataItem !== undefined)
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const items = root.children[1].children[0].children[5].children[1].children
    const lp = R.filter(item => item.attributes.dataItemId === 'dev_clp', items)
    //console.log(body)
    assert(lp.length === 1)
    assert(lp[0].name === 'Unavailable')
    done()
  })

  it('checks for dups', function*(done){
    const jsonObj = common.inputParsing('TIME|clp|NORMAL||||XXX', '000')
    lokijs.dataCollectionUpdate(jsonObj, '000')
    
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
    const jsonObj = common.inputParsing('TIME|clp|FAULT|2218|ALARM_B|HIGH|2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF', '000')
    lokijs.dataCollectionUpdate(jsonObj, '000')

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
    const jsonObj = common.inputParsing('TIME|clp|NORMAL||||', '000')
    lokijs.dataCollectionUpdate(jsonObj, '000')
    
    const { body } = yield request(`http://${ip}:7000/current`)
    const obj = parse(body)
    const { root } = obj
    const conditionItems = root.children[1].children[0].children[5].children[1].children
    const normalItems = R.filter(item => item.attributes.dataItemId === 'dev_clp', conditionItems)
    const normalItem = R.filter(item => item.name === 'Normal', normalItems)

    assert(normalItems.length === 1)
    assert(normalItem.length === 1)
    done()
  })

  it('changes normal status to fault again', function*(done){
    const jsonObj = common.inputParsing('TIME|clp|FAULT|4200|ALARM_D||4200 ALARM_D Power on effective parameter set', '000')
    lokijs.dataCollectionUpdate(jsonObj, '000')

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
    const jsonObj = common.inputParsing('TIME|clp|FAULT|2218|ALARM_B|HIGH|2218-1 ALARM_B UNUSABLE G-code  A side FFFFFFFF', '000')
    lokijs.dataCollectionUpdate(jsonObj, '000')
    
    const { body } = yield request(`http://${ip}:7000/current`)
    //console.log(rawData.data)
    //console.log(body)
    done()
  })
})

describe('testEmptyLastItemFromAdapter()', () => {
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
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
    stub.restore()
  })

  it('gets dataItems by Ids', () => {
    const block = lokijs.getDataItemForId('dev_cn2', '000')
    const program = lokijs.getDataItemForId('dev_cn5', '000')
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
    const jsonObj = common.inputParsing('TIME|program|A|block|B', '000')
    lokijs.dataCollectionUpdate(jsonObj, '000')
    
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
    const jsonObj = common.inputParsing('TIME|program||block|B', '000')
    lokijs.dataCollectionUpdate(jsonObj, '000')
    
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
    const jsonObj = common.inputParsing('TIME|program||block|', '000')
    lokijs.dataCollectionUpdate(jsonObj, '000')
    
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
    const jsonObj1 = common.inputParsing('TIME|program|A|block|B', '000')
    lokijs.dataCollectionUpdate(jsonObj1, '000')
    const jsonObj2 = common.inputParsing('TIME|program|A|block|', '000')
    lokijs.dataCollectionUpdate(jsonObj2, '000')
    
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
    const jsonObj1 = common.inputParsing('TIME|program|A|block|B|line|C', '000')
    lokijs.dataCollectionUpdate(jsonObj1, '000')
    const jsonObj2 = common.inputParsing('TIME|program|D|block||line|E', '000')
    lokijs.dataCollectionUpdate(jsonObj2, '000')
    
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
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/reference_example.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
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
  let stub
  
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    const xml = fs.readFileSync('./test/support/reference_example.xml', 'utf8')
    const jsonFile = xmlToJSON.xmlToJSON(xml)
    lokijs.insertSchemaToDB(jsonFile)
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
    stub.restore()
  })

  it('return references to dataitem d_c4 and d_d2', function*(done){
    const item = lokijs.getDataItemForId('d_mf', '000')
    const componentName = dataItemjs.getComponent(item)
    const latestSchema = lokijs.searchDeviceSchema('000')
    const foundComponent = componentjs.findComponent(latestSchema, componentName)
    const references = componentjs.getReferences(foundComponent)

    assert(references.length === 2)
    assert(references[0].$.name === 'chuck' && references[1].$.name === 'door')
    assert(references[0].$.dataItemId === 'd_c4' && references[1].$.dataItemId === 'd_d2')
    done()
  })

  it('returns Door and Rotary components with BarFeederInterface componet when request /current?path=//BarFeederInterface', function*(done){
    const { body } = yield request(`http://${ip}:7000/current?path=//BarFeederInterface`)
    //console.log(body)
    done()
  })
})
