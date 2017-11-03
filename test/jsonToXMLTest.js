/* global it, describe, before, after */
/**
  * Copyright 2016, System Insights, Inc.
  *
  * Licensed under the Apache License, Version 2.0 (the "License");
  * you may not use this file except in compliance with the License.
  * You may obtain a copy of the License at
  *
  *    http://www.apache.org/licenses/LICENSE-2.0
  *
  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
  */

// Imports - External

const expect = require('expect.js')
const sinon = require('sinon')
const fs = require('fs')
const parse = require('xml-parser')
const request = require('co-request')
const inspect = require('util').inspect
const http = require('http')
const ip = require('ip')
const config = require('../src/config/config')
const moment = require('moment')
const md5 = require('md5')
const R = require('ramda')
const stream = require('stream')

// Imports - Internal
const dataStorage = require('../src/dataStorage')
const lokijs = require('../src/lokijs')
const jsonToXML = require('../src/jsonToXML')
const ioEntries = require('./support/ioEntries')
const inputJSON = require('./support/sampleJSONOutput')
const json1 = require('./support/json1')
const json2 = require('./support/json2')
const deviceJSON = require('./support/deviceJSON')
const ag = require('../src/agent')
const adapter = require('../adapters/src/adapter')
ag.startAgent = ag.start
ag.stopAgent = ag.stop

const common = require('../src/common')

// constants
const cbPtr = dataStorage.circularBuffer
const schemaPtr = lokijs.getSchemaDB()
const shdr = lokijs.getRawDataDB()
const dataItemInitial = ioEntries.dataItemInitial
const dataItemWithVal = ioEntries.dataItemWithVal
const bufferSize = config.app.agent.bufferSize
const dataItemForSample = ioEntries.dataItemForSample
const dataItemForCount = ioEntries.dataItemForCount
const dataItemsArr = [ { '$': { type: 'AVAILABILITY',
  category: 'EVENT',
  id: 'ifdFcfPh1C',
  name: 'avail' },
  path: '//DataItem' },
{ '$': { type: 'EMERGENCY_STOP',
  category: 'EVENT',
  id: 'BA3qjkMgS5',
  name: 'estop' },
  path: '//DataItem' } ]
const attributes = { name: 'VMC-3Axis', uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef' }
const schema = ioEntries.schema[0]
const uuidCollection = ['000'] 

const isLine = (item) => item.name === 'Line'

describe('updateJSON()', () => {
  describe('creates a JSON with', () => {
    it('latest schema and dataitem values', () => {
      cbPtr.empty()
      shdr.clear()
      schemaPtr.clear()
      shdr.insert({ sequenceId: 0,
        id: 'dtop_2',
        name: 'avail',
        uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef',
        time: '2',
        value: 'AVAILABLE' })
      shdr.insert({ sequenceId: 1,
        id: 'dtop_3',
        name: 'estop',
        uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef',
        time: '2',
        value: 'TRIGGERED' })
      const jsonObj = ioEntries.newJSON
      const resultJSON = jsonToXML.updateJSON(ioEntries.schema, dataItemInitial)
      expect(resultJSON.MTConnectStreams.$).to.eql(jsonObj.MTConnectStreams.$)
      expect(resultJSON.MTConnectStreams.Streams).to.eql(jsonObj.MTConnectStreams.Streams)
    })
  })
})

describe('jsonToXMLStream()', () => {
  const s = new stream.Readable()
  s._read = () => {}

  // let res

  // before(() => {
  //   res = {
  //     body: sinon.stub()
  //   }
  // })

  it('gives the xml response and keeps the connection open', (done) => {
    let xmlString = fs.readFileSync('./test/support/output.xml', 'utf8')
    const tag = 'aaaaaaaaa'
    const secCall = 'Content-type: text/xml\r\n'
    const thirdCall = 'Content-length: 900\r\n\r\n'
    
    // removing the \r\n when read from file
    xmlString = xmlString.replace(/(?:\\[rn]|[\r\n]+)+/g, '\n')
    xmlString = xmlString.replace('</MTConnectDevices>\n', '</MTConnectDevices>\r\n')
    const result = `\r\n--${tag}\r\n${secCall}${thirdCall}${xmlString}`
    
    s.push(JSON.stringify(inputJSON))
    s.push(null)

    s.pipe(jsonToXML.jsonToXMLStream()).pipe(jsonToXML.processStreamXML(tag)).once('data', (data) => {
      expect(data).to.eql(result)
      done()
    })
  })

  it('on error gives the error response and close the connection', (done) => {
    let xmlString = fs.readFileSync('./test/support/output.xml', 'utf8')
    const tag = '\r\n--aaaaaaaaa--\r\n'

    res.end = () => {
      expect(res.write.lastCall.args[0]).to.eql(tag)
      done()
    }
    jsonToXML.jsonToXMLStream(JSON.stringify(inputJSON), 'aaaaaaaaa', res, true)
  })
})

describe('findDataItemForSample()', () => {
  describe('gives the array of DataItem entries for the given id', () => {
    before(() => {
      shdr.clear()
      schemaPtr.clear()
      cbPtr.fill(null).empty()
    })

    after(() => {
      cbPtr.fill(null).empty()
      schemaPtr.clear()
      shdr.clear()
    })

    it('if present', () => {
      const slicedArray = ioEntries.slicedArray
      const resultArr = jsonToXML.findDataItemForSample(slicedArray, 'dtop_2')
      const resultArr1 = jsonToXML.findDataItemForSample(slicedArray, 'dtop_3')
      expect(resultArr[0].Availability._).to.eql('UNAVAILABLE')
      expect(resultArr[1].Availability._).to.eql('AVAILABLE')
      expect(resultArr1[0].EmergencyStop._).to.eql('ARMED')
      expect(resultArr1[1].EmergencyStop._).to.eql('TRIGGERED')
    })

    it('if absent', () => {
      const slicedArray = ioEntries.slicedArray
      const resultArr = jsonToXML.findDataItemForSample(slicedArray, 'dtop')
      expect(resultArr).to.eql(undefined)
    })
  })
})

describe('concatenateDeviceStreams()', () => {
  it('concatenates multiple device streams into one JSON object', () => {
    const jsonArr = []
    jsonArr[0] = json1
    jsonArr[1] = json2
    let result = jsonToXML.concatenateDeviceStreams(jsonArr)
    let devices = result.MTConnectStreams.Streams[0].DeviceStream
    expect(devices.length).to.eql(2)
  })
})

describe('concatenateDevices()', () => {
  it('concatenate multiple devices into one JSON object', () => {
    const jsonArr = []
    jsonArr[0] = deviceJSON
    jsonArr[1] = deviceJSON
    let result = jsonToXML.concatenateDevices(jsonArr)
    let devices = result.MTConnectDevices.Devices[0].Device
    expect(devices.length).to.eql(2)
  })
})

describe('calculateSequence() calculate the nextSequence depending on request type', () => {
  let stub
  let obj = {
    firstSequence: 0,
    lastSequence: 10,
    nextSequence: 5
  }
  before(() => {
    stub = sinon.stub(dataStorage, 'getSequence')
    stub.returns(obj)
  })

  after(() => {
    stub.restore()
  })

  it('for /current it will be lastSequence + 1', () => {
    let result = jsonToXML.calculateSequence()
    expect(result.nextSequence).to.eql(obj.lastSequence + 1)
  })
  it('for /sample it will be the last sequenceId + 1, in the sample set', () => {
    let result = jsonToXML.calculateSequence('SAMPLE')
    expect(result.nextSequence).to.eql(obj.nextSequence)
  })
})

describe('createErrorResponse() gives the error response based on the error Category', () => {
  let stub
  const obj = {
    firstSequence: 1100,
    lastSequence: 1200
  }
  before(() => {
    stub = sinon.stub(dataStorage, 'getSequence')
    stub.returns(obj)
  })

  after(() => {
    stub.restore()
  })

  it('errorCategory = MULTIPART_STREAM: gives OUT_OF_RANGE error when from < firstSequence', () => {
    const result = jsonToXML.createErrorResponse(101, 'MULTIPART_STREAM', 1000)
    const multiStreamError = ioEntries.multiStreamError
    expect(result.MTConnectError.$).to.eql(multiStreamError.MTConnectError.$)
    expect(result.MTConnectError.Errors).to.eql(multiStreamError.MTConnectError.Errors)
  })

  it('errorCategory = MULTIPART_STREAM: gives OUT_OF_RANGE error from > lastSequence', () => {
    const result = jsonToXML.createErrorResponse(101, 'MULTIPART_STREAM', 1300)
    const multiStreamError1 = ioEntries.multiStreamError1
    expect(result.MTConnectError.$).to.eql(multiStreamError1.MTConnectError.$)
    expect(result.MTConnectError.Errors).to.eql(multiStreamError1.MTConnectError.Errors)
  })

  it('errorCategory = UNSUPPORTED_PUT: gives UNSUPPORTED error', () => {
    const value = 'Unsupported put error'
    const result = jsonToXML.createErrorResponse(101, 'UNSUPPORTED_PUT', value)
    const unsupportedErr = ioEntries.unsupportedErr
    expect(result.MTConnectError.$).to.eql(unsupportedErr.MTConnectError.$)
    expect(result.MTConnectError.Errors).to.eql(unsupportedErr.MTConnectError.Errors)
  })
})

describe('Frequency/Interval Error', () => {
  const instanceId = 101

  it('freq non Integer - OUT_OF_RANGE error', () => {
    const errorJSON = jsonToXML.createErrorResponse(instanceId)
    const errorObj = errorJSON.MTConnectError.Errors
    const result = jsonToXML.categoriseError(errorObj, 'INTERVAL', 1.256)
    const error = result[0].Error[0]
    const CDATA = `\'interval\' must be a positive integer.`
    expect(error.$.errorCode).to.eql('OUT_OF_RANGE')
    expect(error._).to.eql(CDATA)
  })

  it('freq < 0 - OUT_OF_RANGE error', () => {
    const errorJSON = jsonToXML.createErrorResponse(instanceId)
    const errorObj = errorJSON.MTConnectError.Errors
    const result = jsonToXML.categoriseError(errorObj, 'INTERVAL', -1)
    const error = result[0].Error[0]
    const CDATA = `\'interval\' must be a positive integer.`
    expect(error.$.errorCode).to.eql('OUT_OF_RANGE')
    expect(error._).to.eql(CDATA)
  })

  it('freq > maximum frequency permitted - OUT_OF_RANGE error', () => {
    const maxFreq = 2147483646
    const errorJSON = jsonToXML.createErrorResponse(instanceId)
    const errorObj = errorJSON.MTConnectError.Errors
    const result = jsonToXML.categoriseError(errorObj, 'INTERVAL', maxFreq + 1)
    const error = result[0].Error[0]
    const CDATA = `\'interval\' must be greater than or equal to ${maxFreq}.`
    expect(error.$.errorCode).to.eql('OUT_OF_RANGE')
    expect(error._).to.eql(CDATA)
  })
})
/* ****************************Integrated Tests********************************** */
describe('printError()', () => {
  const options = {
    hostname: ip.address(),
    port: 7000,
    path: '/current'
  }

  let stub1

  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    stub1 = sinon.stub(common, 'getAllDeviceUuids')
    stub1.returns([])
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub1.restore()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })

  it('should return XML Error', (done) => {
    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content
        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('NO_DEVICE')
        done()
      })
    })
  })
})

describe('printProbe()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  let stub1
  //let uuidCollection = ['000']
  before(() => {
    stub = sinon.stub(lokijs, 'searchDeviceSchema')
    stub.returns([schema])
    stub1 = sinon.stub(common, 'getAllDeviceUuids')
    stub1.returns([uuid])
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub1.restore()
    stub.restore()
  })

  it('should return probe response', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/probe'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let dataItem = child.children[1].children

        expect(root.name).to.eql('MTConnectDevices')
        expect(child.name).to.eql('Device')
        expect(child.attributes).to.eql(attributes)
        expect(dataItem.length).to.eql(2)
        expect(dataItem[0].name).to.eql('dataItem')
        done()
      })
    })
  })
})

describe('printCurrent()', () => {
  let stub
  let stub1
  let stub2
  let stub3

  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const options = {
    hostname: ip.address(),
    port: 7000,
    path: '/current'
  }

  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    shdr.insert({ sequenceId: 0,
      id: 'avail',
      uuid: 'ifdFcfPh1C',
      time: '2',
      value: 'AVAILABLE' })
    shdr.insert({ sequenceId: 1,
      id: 'estop',
      uuid: 'BA3qjkMgS5',
      time: '2',
      value: 'TRIGGERED' })
    stub = sinon.stub(lokijs, 'searchDeviceSchema')
    stub.returns([schema])
    stub1 = sinon.stub(lokijs, 'getDataItems')
    stub1.returns(dataItemsArr)
    stub2 = sinon.stub(dataStorage, 'categoriseDataItem')
    stub2.returns(dataItemWithVal)
    stub3 = sinon.stub(common, 'getAllDeviceUuids')
    stub3.returns([uuid])
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub3.restore()
    stub2.restore()
    stub1.restore()
    stub.restore()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })

  it('should return the XML current response', (done) => {
    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let nameEvent = child.children[0].children[0].name
        let avail = child.children[0].children[0].children[0]
        let estop = child.children[0].children[0].children[1]

        expect(root.name).to.eql('MTConnectStreams')
        expect(child.name).to.eql('DeviceStream')
        expect(child.attributes).to.eql(attributes)
        expect(nameEvent).to.eql('Events')
        expect(avail.name).to.eql('Availability')
        expect(avail.content).to.eql('AVAILABLE')
        expect(estop.name).to.eql('EmergencyStop')
        expect(estop.content).to.eql('TRIGGERED')
        done()
      })
    })
  })
})

describe('printCurrentAt()', () => {
  let stub
  let stub1
  let stub2
  let stub3
  const options = {
    hostname: ip.address(),
    port: 7000,
    path: '/current?at=1'
  }

  before(() => {
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    shdr.insert({ sequenceId: 1,
      id: 'avail',
      uuid: '000',
      time: '2',
      value: 'AVAILABLE' })
    shdr.insert({ sequenceId: 2,
      id: 'estop',
      uuid: '000',
      time: '2',
      value: 'TRIGGERED' })
    stub = sinon.stub(lokijs, 'searchDeviceSchema')
    stub.returns([schema])
    stub1 = sinon.stub(lokijs, 'getDataItems')
    stub1.returns(dataItemsArr)
    stub2 = sinon.stub(dataStorage, 'categoriseDataItem')
    stub2.returns(dataItemWithVal)
    stub3 = sinon.stub(common, 'getAllDeviceUuids')
    stub3.returns(uuidCollection)
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub3.restore()
    stub2.restore()
    stub1.restore()
    stub.restore()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
  })

  it('should return the XML current at response when requested sequenceId is within the first and last Sequence ', (done) => {
    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let nameEvent = child.children[0].children[0].name
        let avail = child.children[0].children[0].children[0]
        let estop = child.children[0].children[0].children[1]

        expect(root.name).to.eql('MTConnectStreams')
        expect(child.name).to.eql('DeviceStream')
        expect(child.attributes).to.eql(attributes)
        expect(nameEvent).to.eql('Events')
        expect(avail.name).to.eql('Availability')
        expect(avail.content).to.eql('AVAILABLE')
        expect(estop.name).to.eql('EmergencyStop')
        expect(estop.content).to.eql('TRIGGERED')
        done()
      })
    })
  })
})

describe('printCurrentAt(), when at is out of range', () => {
  let stub

  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(uuidCollection)
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub.restore()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
  })

  it('gives ERROR response', (done) => {
    const sequence = dataStorage.getSequence()
    const lastSequence = sequence.lastSequence
    const reqVal = lastSequence + 1
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/current?at=${reqVal}`
    }
    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content

        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('OUT_OF_RANGE')
        expect(content).to.eql(`\'at\' must be less than or equal to ${lastSequence}.`)
        done()
      })
    })
  })
})

describe('current?path', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub

  before(() => {
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashAdapters.clear()
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub.restore()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
  })

  it('gets the current response for the dataItems in the specified path', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/current?path=//Axes//Linear//DataItem[@subType="ACTUAL"]'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)

        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0].children
        let child1 = child[0].children[0].children[0]
        let child2 = child[1].children[0].children[0]
        let child3 = child[2].children[0].children[0]

        expect(child.length).to.eql(3)
        expect(child1.attributes.name).to.eql('Xact')
        expect(child2.attributes.name).to.eql('Yact')
        expect(child3.attributes.name).to.eql('Zact')
        done()
      })
    })
  })

  it('current?path=&at= gives the current response at sequence number provided `\ at= \`', (done) => {
    const getSequence = dataStorage.getSequence()
    const seqNumber = getSequence.lastSequence
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/current?path=//Axes//Linear//DataItem[@subType="ACTUAL"]&at=${seqNumber}`
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)

        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0].children
        let child1 = child[0].children[0].children[0]
        let child2 = child[1].children[0].children[0]
        let child3 = child[2].children[0].children[0]

        expect(child.length).to.eql(3)
        expect(child1.attributes.name).to.eql('Xact')
        expect(child2.attributes.name).to.eql('Yact')
        expect(child3.attributes.name).to.eql('Zact')
        done()
      })
    })
  })
})

describe('currentAtOutOfRange() gives the following errors ', () => {
  let stub
  let stub1
  let stub2
  let stub3

  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    shdr.insert({ sequenceId: 1,
      id: 'avail',
      uuid: '000',
      time: '2',
      value: 'AVAILABLE' })
    shdr.insert({ sequenceId: 2,
      id: 'estop',
      uuid: '000',
      time: '2',
      value: 'TRIGGERED' })
    for(let i = 1; i < bufferSize; i++){
      shdr.insert({ sequenceId: i+2,
      id: 'id' + i,
      uuid: '000',
      time: '2',
      dataItemName: 'avail',
      value: 'CHECK' + i })
    }
    
    stub = sinon.stub(lokijs, 'searchDeviceSchema')
    stub.returns([schema])
    stub1 = sinon.stub(lokijs, 'getDataItems')
    stub1.returns(dataItemsArr)
    stub2 = sinon.stub(dataStorage, 'categoriseDataItem')
    stub2.returns('ERROR')
    stub3 = sinon.stub(common, 'getAllDeviceUuids')
    stub3.returns(uuidCollection)
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub3.restore()
    stub2.restore()
    stub1.restore()
    stub.restore()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })

  it('\'at must be positive integer\' when at value is negative', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/current?at=-10'
    }
    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content
        let detail = inspect(obj, {colors: true, depth: Infinity})

        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('OUT_OF_RANGE')
        expect(content).to.eql('\'at\' must be a positive integer.')
        done()
      })
    })
  })

  it('\'at must be greater than or equal to firstSequenceId\' when at value is lesser than the range', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/current?at=1'
    }
    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content
        let detail = inspect(obj, {colors: true, depth: Infinity})
        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('OUT_OF_RANGE')
        expect(content).to.eql('\'at\' must be greater than or equal to 2.')
        done()
      })
    })
  })

  it('\'at must be less than or equal to lastsequenceId\' when at value is greater than the range', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/current?at=${bufferSize + 100}`
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content
        const cbPtr1 = cbPtr.toArray()

        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('OUT_OF_RANGE')
        expect(content).to.eql('\'at\' must be less than or equal to ' + cbPtr1[cbPtr1.length - 1].sequenceId + '.')
        done()
      })
    })
  })
})

describe('Current request with interval/frequency argument and at specified', () => {
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    sequence = dataStorage.getSequence()
    const seq1 = sequence.lastSequence + 1
    const seq2 = seq1 + 1
    shdr.insert({ sequenceId: `${seq1}`,
      id: 'hlow',
      uuid: '000',
      time: '2',
      value: 'AVAILABLE',
      path: '//Devices//Device[@name="VMC-3Axis"]//Systems//Hydraulic//DataItem[@type="LEVEL"]' })
    shdr.insert({ sequenceId: `${seq2}`,
      id: 'htemp',
      uuid: '000',
      time: '2',
      value: 'UNAVAILABLE',
      path: '//Devices//Device[@name="VMC-3Axis"]//Systems//Hydraulic//DataItem[@type="TEMPERATURE"]' })
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(uuidCollection)
    ag.startAgent()
  })
  after(() => {
    ag.stopAgent()
    stub.restore()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
  })
  it('gives INVALID_REQUEST error', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/current?interval=1000&at=100'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content
        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('INVALID_REQUEST')
        expect(content).to.eql('You cannot specify both the at and frequency arguments to a current request.')
        done()
      })
    })
  })
})

describe('printSample(), request /sample is given', () => {
  let stub
  let stub1
  let stub2
  let stub3
  let stub4
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'

  before(() => {
    stub = sinon.stub(lokijs, 'searchDeviceSchema')
    stub.returns([schema])
    stub1 = sinon.stub(lokijs, 'getDataItems')
    stub1.returns(dataItemsArr)
    stub2 = sinon.stub(dataStorage, 'categoriseDataItem')
    stub2.returns(dataItemForSample)
    stub3 = sinon.stub(common, 'getAllDeviceUuids')
    stub3.returns([uuid])
    stub4 = sinon.stub(dataStorage, 'getBufferSize')
    stub4.returns(1000)
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    shdr.insert({ sequenceId: 1,
      id: 'avail',
      uuid: '000',
      time: '2',
      value: 'AVAILABLE' })
    shdr.insert({ sequenceId: 2,
      id: 'estop',
      uuid: '000',
      time: '2',
      value: 'TRIGGERED' })

    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    shdr.clear()
    stub4.restore()
    stub3.restore()
    stub2.restore()
    stub1.restore()
    stub.restore()
  })

  it('without path or from & count it should give first 100 dataItems in the queue as response', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let nameEvent = child.children[0].children[0].name
        let avail = child.children[0].children[0].children[0]
        let estop = child.children[0].children[0].children[9]

        expect(root.name).to.eql('MTConnectStreams')
        expect(child.name).to.eql('DeviceStream')
        expect(child.attributes).to.eql(attributes)
        expect(nameEvent).to.eql('Events')
        expect(avail.name).to.eql('Availability')
        expect(avail.content).to.eql('UNAVAILABLE')
        expect(estop.name).to.eql('EmergencyStop')
        expect(estop.content).to.eql('TRIGGERED')
        done()
      })
    })
  })

  it('with from & count', (done) => {
    stub2.returns(dataItemForCount)
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?from=1&count=2'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)

        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let nameEvent = child.children[0].children[0].name
        let avail = child.children[0].children[0].children[0]
        let estop = child.children[0].children[0].children[1]

        expect(root.name).to.eql('MTConnectStreams')
        expect(child.name).to.eql('DeviceStream')
        expect(child.attributes).to.eql(attributes)
        expect(nameEvent).to.eql('Events')
        expect(avail.name).to.eql('Availability')
        expect(avail.content).to.eql('UNAVAILABLE')
        expect(estop.name).to.eql('EmergencyStop')
        expect(estop.content).to.eql('ARMED')
        done()
      })
    })
  })
})

describe('Test bad Count', () => {
  let stub1
  let stub2

  before(() => {
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    shdr.insert({ sequenceId: 1,
      id: 'avail',
      uuid: '000',
      time: '2',
      value: 'AVAILABLE' })
    shdr.insert({ sequenceId: 2,
      id: 'estop',
      uuid: '000',
      time: '2',
      value: 'TRIGGERED' })
    stub1 = sinon.stub(lokijs, 'getDataItems')
    stub1.returns(dataItemsArr)
    stub2 = sinon.stub(common, 'getAllDeviceUuids')
    stub2.returns(['000'])
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub2.restore()
    stub1.restore()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
  })

  it('when the count is 0', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/sample?from=1&count=0`
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content

        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('INVALID_REQUEST')
        expect(content).to.eql(`\'count\' must be greater than or equal to 1.`)
        done()
      })
    })
  })

  it('when the count is non integer', function * () {
    const { body } = yield request(`http://${ip.address()}:7000/sample?from=1&count=1.98`)
    let obj = parse(body)
    let root = obj.root
    let child = root.children[1].children[0]
    let errorCode = child.attributes.errorCode
    let content = child.content

    expect(root.name).to.eql('MTConnectError')
    expect(errorCode).to.eql('OUT_OF_RANGE')
    expect(content).to.eql('\'count\' must be a positive integer.')
  })

  it('when the count is negative', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?from=1&count=-2'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content

        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('OUT_OF_RANGE')
        expect(content).to.eql('\'count\' must be a positive integer.')
        done()
      })
    })
  })

  it('when the count is larger than buffer size', (done) => {
    const size = config.app.agent.bufferSize
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/sample?from=1&count=${size + 100}`
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content

        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('OUT_OF_RANGE')
        expect(content).to.eql(`\'count\' must be less than or equal to ${size}.`)
        done()
      })
    })
  })
})

describe('sample?path=', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  let stub1
  let sequence

  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashAdapters.clear()
    dataStorage.hashDataItemsByName.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    sequence = dataStorage.getSequence()
    const seq1 = sequence.lastSequence + 1
    const seq2 = seq1 + 1
    shdr.insert({ sequenceId: `${seq1}`,
      id: lokijs.getDataItem(uuid, 'hlow').$.id,
      uuid,
      time: '2',
      value: 'AVAILABLE',
      path: '//Devices//Device[@name="VMC-3Axis"]//Systems//Hydraulic//DataItem[@type="LEVEL"]' })
    shdr.insert({ sequenceId: `${seq2}`,
      id: lokijs.getDataItem(uuid, 'htemp').$.id,
      uuid,
      time: '2',
      value: 'UNAVAILABLE',
      path: '//Devices//Device[@name="VMC-3Axis"]//Systems//Hydraulic//DataItem[@type="TEMPERATURE"]' })
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    stub1 = sinon.stub(dataStorage, 'getBufferSize')
    stub1.returns(1000)
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub1.restore()
    stub.restore()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.hashDataItemsByName.clear()
  })

  it('gives dataItems in the specified path for default count 100', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0].children[0].children[0].children
        expect(child.length).to.eql(5)
        expect(child[0].attributes.name).to.eql('hlow')
        expect(child[1].attributes.name).to.eql('hlow')
        expect(child[2].attributes.name).to.eql('hpres')
        expect(child[3].attributes.name).to.eql('htemp')
        expect(child[4].attributes.name).to.eql('htemp')
        done()
      })
    })
  })

  it('with path and from&count', (done) => {
    const lastSequence = sequence.lastSequence
    const value = lastSequence - 5
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic&from=${value}&count=5`
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0].children[0].children[0].children
        expect(child.length).to.eql(2)
        expect(child[0].attributes.name).to.eql('hlow')
        expect(child[1].attributes.name).to.eql('hpres')
        done()
      })
    })
  })

  it('with path and from+count > lastsequence', (done) => {
    const lastSequence = sequence.lastSequence + 2
    const value = lastSequence
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/sample?path=//Device[@name="VMC-3Axis"]//Hydraulic&from=${value}&count=5`
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0].children[0].children[0].children
        expect(child.length).to.eql(1)
        expect(child[0].attributes.name).to.eql('htemp')
        done()
      })
    })
  })
})

describe('ipaddress:port/devicename/', () => {
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })

  describe('give the requested response for the given deviceName', () => {
    it('if present', (done) => {
      const options = {
        hostname: ip.address(),
        port: 7000,
        path: '/VMC-3Axis/current?path=//Device[@name="VMC-3Axis"]'
      }

      http.get(options, (res) => {
        res.on('data', (chunk) => {
          const xml = String(chunk)
          let obj = parse(xml)
          let root = obj.root
          let name = root.children[1].children[0].attributes.name
          expect(name).to.eql('VMC-3Axis')
          done()
        })
      })
    })

    it('if absent, will send NO_DEVICE error as xml', (done) => {
      const options = {
        hostname: ip.address(),
        port: 7000,
        path: '/VMC-3Axis-1/current?path=//Device[@name="VMC-3Axis"]'
      }

      http.get(options, (res) => {
        res.on('data', (chunk) => {
          const xml = String(chunk)
          let obj = parse(xml)
          let root = obj.root
          let child = root.children[1].children[0]
          let errorCode = child.attributes.errorCode
          let content = child.content
          let expectedContent = 'Could not find the device VMC-3Axis-1.'
          expect(root.name).to.eql('MTConnectError')
          expect(errorCode).to.eql('NO_DEVICE')
          expect(content).to.eql(expectedContent)
          done()
        })
      })
    })
  })
})

describe('badPath and badXPath', () => {
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })
  it('gives UNSUPPORTED path error when path is too long', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/VMC-3Axis/garbage/current?path=//Device[@name="VMC-3Axis"]'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let name = root.name
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content
        let expectedContent = `The following path is invalid: ${options.path}.`
        expect(name).to.eql('MTConnectError')
        expect(errorCode).to.eql('UNSUPPORTED')
        expect(content).to.eql(expectedContent)
        done()
      })
    })
  })
  it('gives INVALID_XPATH error when path is not present', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/VMC-3Axis/current?path=//"AXES"'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let name = root.name
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content
        let expectedContent = `The path could not be parsed. Invalid syntax: //"AXES".`
        expect(name).to.eql('MTConnectError')
        expect(errorCode).to.eql('INVALID_XPATH')
        expect(content).to.eql(expectedContent)
        done()
      })
    })
  })
})

describe('When a request does not contain current, sample or probe', () => {
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })
  it('gives UNSUPPORTED error', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/VMC-3Axis/garbage/check?path=//Device[@name="VMC-3Axis"]'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let name = root.name
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content
        let expectedContent = `The following path is invalid: ${options.path}.`
        expect(name).to.eql('MTConnectError')
        expect(errorCode).to.eql('UNSUPPORTED')
        expect(content).to.eql(expectedContent)
        done()
      })
    })
  })
})

describe('emptyStream', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  let stub1
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.size = 10
    cbPtr.fill(null).empty()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    stub1 = sinon.stub(dataStorage, 'getBufferSize')
    stub1.returns(1000)
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub1.restore()
    stub.restore()
    cbPtr.size = bufferSize
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
  })
  it('gives an empty MTConnectStreams without any dataItems', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?path=//Axes'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        expect(root.name).to.eql('MTConnectStreams')
        expect(child.name).to.eql('DeviceStream')
        expect(child.attributes).to.eql(attributes)
        expect(child.children.length).to.eql(0)
        done()
      })
    })
  })
})

describe('invalid "from" value', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub.restore()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
  })

  it('from = non integer value, OUT_OF_RANGE error: from must be a positive integer', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?from=abc'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content

        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('OUT_OF_RANGE')
        expect(content).to.eql('\'from\' must be a positive integer.')
        done()
      })
    })
  })

  it('from < 0, OUT_OF_RANGE error: from must be a positive integer', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?from=-1'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content

        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('OUT_OF_RANGE')
        expect(content).to.eql('\'from\' must be a positive integer.')
        done()
      })
    })
  })

  it('from < firstSequenceId, OUT_OF_RANGE error: from must be greater than or equal to firstSequence ', (done) => {
    let sequence = dataStorage.getSequence()
    let firstSequence = sequence.firstSequence
    let reqSeq = firstSequence - 1
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/sample?from=${reqSeq}`
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content

        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('OUT_OF_RANGE')
        expect(content).to.eql(`\'from\' must be greater than or equal to ${firstSequence}.`)
        done()
      })
    })
  })

  it('from > lastsequenceId, OUT_OF_RANGE error: from must be less than or equal to lastSequence ', (done) => {
    let sequence = dataStorage.getSequence()
    let lastSequence = sequence.lastSequence
    let reqSeq = lastSequence + 1
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/sample?from=${reqSeq}`
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0]
        let errorCode = child.attributes.errorCode
        let content = child.content

        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('OUT_OF_RANGE')
        expect(content).to.eql(`\'from\' must be less than or equal to ${lastSequence}.`)
        done()
      })
    })
  })
})

describe('Multiple Errors', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub

  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub.restore()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
  })

  it('gives multiple errors in a response to /sample', function * () {
    // path - This is an xpath expression specifying the components and/or data items to include in the
    // sample. If the path specifies a component, all data items for that component and any of its sub-
    // components MUST be included. For example, if the application specifies the path=//Axes,
    // then all the data items for the Axes component as well as the Linear and Rotary sub-
    // components MUST be included as well. The path MUST also include any
    // ComponentReference and DataItemReference that have been associated by another
    // component in the References collection. These items MUST be included as if the xpath had been
    // explicitly included in the path.
    //
    // from - This parameter requests Events, Condition, and Samples starting at this sequence
    // number. The sequence number can be obtained from a prior current or sample request. The
    // response MUST provide the nextSequence number. If the value is 0 the first available
    // sample or event MUST be used. If the value is less than 0 (< 0) an INVALID_REQUEST error
    // MUST be returned.

    // count - The maximum number of Events, Condition, and Samples to consider, see detailed
    // explanation below. Events, Condition, and Samples will be considered between from and from
    // + count, where the latter is the lesser of from + count and the last sequence number
    // stored in the agent. The Agent MUST NOT send back more than this number of Events,
    // Condition, and Samples (in aggregate), but fewer Events, Condition, and Samples MAY be
    // returned. If the value is less than 1 (< 1) an INVALID_REQUEST error MUST be returned.

    const url = `http://${ip.address()}:7000/sample?path=//Axes//Garbage&from=0&count=0`
    let { body } = yield request(url)
    let { root } = parse(body)
    let name = root.name
    let child = root.children[1].children
    expect(name).to.eql('MTConnectError')
    expect(child.length).to.eql(3)
    expect(child[0].attributes.errorCode).to.eql('INVALID_XPATH')
    expect(child[1].attributes.errorCode).to.eql('INVALID_REQUEST')
    expect(child[2].attributes.errorCode).to.eql('INVALID_REQUEST')
  })

  it('gives multiple errors in a response to /current', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/current?path=//Axes//Garbage&at=1000'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let name = root.name
        let child = root.children[1].children
        expect(name).to.eql('MTConnectError')
        expect(child.length).to.eql(2)
        expect(child[0].attributes.errorCode).to.eql('INVALID_XPATH')
        expect(child[1].attributes.errorCode).to.eql('OUT_OF_RANGE')
        done()
      })
    })
  })
})

describe('Condition()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const shdrString1 = '2010-09-29T23:59:33.460470Z|htemp|WARNING|HTEMP|1|HIGH|Oil Temperature High'
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    common.parsing(shdrString1, uuid)
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashAdapters.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })

  it('gives the status of a device - NORMAL, FAULT, UNAVAILABLE, WARNING', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/VMC-3Axis/current?path=//Device[@name="VMC-3Axis"]//Hydraulic'
    }
    
    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1].children[0].children[0].children
        let lastChild = child[0].children[2]
        let attributes = lastChild.attributes
        expect(child[0].name).to.eql('Condition')
        expect(lastChild.name).to.eql('Warning')
        expect(attributes.nativeCode).to.eql('HTEMP')
        expect(attributes.nativeSeverity).to.eql('1')
        expect(attributes.qualifier).to.eql('HIGH')
        expect(lastChild.content).to.eql('Oil Temperature High')
        done()
      })
    })
  })
})

describe('/sample response for dataItem with type', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const shdrString6 = '2016-09-29T23:59:33.460470Z|msg|CHG_INSRT|Change Inserts'
  const shdrString7 = '2016-09-29T23:59:33.460470Z|msg||Change Inserts'
  
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    common.parsing(shdrString6, uuid)
    common.parsing(shdrString7, uuid)
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub.restore()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashAdapters.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })
  it('MESSAGE', (done) => {
    const getSequence = dataStorage.getSequence()
    const lastSequence = getSequence.lastSequence
    const from = lastSequence - 3
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: `/sample?from=${from}&count=10`
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        const obj = parse(xml)
        const root = obj.root
        const child = root.children[1]
        const children = child.children[0].children[0].children[0].children
        const child1 = children[0]
        const child2 = children[1]
        expect(child1.name).to.eql(child2.name)
        expect(child2.attributes.dataItemId).to.eql(child1.attributes.dataItemId)
        expect(child1.attributes.nativeCode).to.eql('CHG_INSRT')
        expect(child2.attributes.nativeCode).to.eql(undefined)
        expect(child1.content).to.eql(child2.content)
        done()
      })
    })
  })
})
/* ************************************* Asset ************************** */
describe('printEmptyAsset', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub
  let stub1

  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    stub1 = sinon.stub(lokijs, 'getAssetCollection')
    stub1.returns([])
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub1.restore()
    stub.restore()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
  })
  it('/asset give empty asset response when no assets are present', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/assets'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1]
        let children = child.children
        expect(root.name).to.eql('MTConnectAssets')
        expect(child.name).to.eql('Assets')
        expect(children.length).to.eql(0)
        done()
      })
    })
  })
})

describe('printAsset()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let shdr1 = '2016-07-25T05:50:22.303002Z|@ASSET@|EM233|CuttingTool|<CuttingTool serialNumber="ABC" toolId="10" assetId="ABC">' +
  '<Description></Description><CuttingToolLifeCycle><ToolLife countDirection="UP" limit="0" type="MINUTES">160</ToolLife>' +
  '<Location type="POT">10</Location><Measurements><FunctionalLength code="LF" minimum="0" nominal="3.7963">3.7963</FunctionalLength>' +
  '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>'
  let shdr2 = '2016-07-25T05:50:25.303002Z|@ASSET@|EM262|CuttingTool|<CuttingTool serialNumber="XYZ" toolId="11" assetId="XYZ">' +
  '<Description></Description><CuttingToolLifeCycle><ToolLife countDirection="UP" limit="0" type="MINUTES">341</ToolLife>' +
  '<Location type="POT">11</Location><Measurements><FunctionalLength code="LF" minimum="0" nominal="4.12213">4.12213</FunctionalLength>' +
  '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>'
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    common.parsing(shdr1, uuid)
    common.parsing(shdr2, uuid)
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub.restore()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })

  it('simple asset request with one assetId specified', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/assets/EM233'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1]
        let children = child.children
        expect(root.name).to.eql('MTConnectAssets')
        expect(child.name).to.eql('Assets')
        expect(children[0].name).to.eql('CuttingTool')
        expect(children[0].attributes.assetId).to.eql('EM233')
        done()
      })
    })
  })

  it('simple asset request with multiple assetIds specified', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/assets/EM233;EM262'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1]
        let children = child.children
        expect(root.name).to.eql('MTConnectAssets')
        expect(child.name).to.eql('Assets')
        expect(children.length).to.eql(2)
        expect(children[0].attributes.assetId).to.eql('EM233')
        expect(children[1].attributes.assetId).to.eql('EM262')
        done()
      })
    })
  })

  it('/assets give all assets in the order of occurence (recent one first)', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/assets'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1]
        let children = child.children
        expect(root.name).to.eql('MTConnectAssets')
        expect(child.name).to.eql('Assets')
        expect(children.length).to.eql(2)
        expect(children[0].attributes.assetId).to.eql('EM262')
        expect(children[1].attributes.assetId).to.eql('EM233')
        done()
      })
    })
  })

  it('asset req "/deviceName/assets/assetId" gives the details of the specified asset with target deviceName', function * r () {
    const { body } = yield request('http://0.0.0.0:7000/VMC-3Axis/assets/EM233')
    const xml = String(body)
    let obj = parse(xml)
    let root = obj.root
    let child = root.children[1]
    let children = child.children
    expect(root.name).to.eql('MTConnectAssets')
    expect(child.name).to.eql('Assets')
    expect(children.length).to.eql(1)
    expect(children[0].attributes.assetId).to.eql('EM233')
  })

  // Eg: http://example.com/Mill123/assets
  it(`asset request '/deviceName/assets' gives all the assets associated with specified device`, (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/VMC-3Axis/assets'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        let obj = parse(xml)
        let root = obj.root
        let child = root.children[1]
        let children = child.children
        expect(root.name).to.eql('MTConnectAssets')
        expect(child.name).to.eql('Assets')
        expect(children.length).to.eql(2)
        expect(children[0].attributes.assetId).to.eql('EM262')
        expect(children[1].attributes.assetId).to.eql('EM233')
        done()
      })
    })
  })
})

describe('asset Filtering', () => {
  const uuid1 = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const uuid2 = '3f707e77-7b44-55a0-9aba-2a671d5e7089'
  let stub
  const shdr1 = '2016-07-25T05:50:22.303002Z|@ASSET@|EM233|Garbage|<CuttingTool serialNumber="ABC" toolId="10" assetId="ABC">' +
  '<Description></Description><CuttingToolLifeCycle><ToolLife countDirection="UP" limit="0" type="MINUTES">160</ToolLife>' +
  '<Location type="POT">10</Location><Measurements><FunctionalLength code="LF" minimum="0" nominal="3.7963">3.7963</FunctionalLength>' +
  '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>'
  const shdr2 = '2016-07-25T05:50:25.303002Z|@ASSET@|EM262|CuttingTool|<CuttingTool serialNumber="XYZ" toolId="11" assetId="XYZ">' +
  '<Description></Description><CuttingToolLifeCycle><ToolLife countDirection="UP" limit="0" type="MINUTES">341</ToolLife>' +
  '<Location type="POT">11</Location><Measurements><FunctionalLength code="LF" minimum="0" nominal="4.12213">4.12213</FunctionalLength>' +
  '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>'
  const shdr3 = '2016-07-25T05:50:27.303002Z|@ASSET@|EM263|CuttingTool|<CuttingTool serialNumber="GHI" toolId="10" assetId="ABC">' +
  '<Description></Description><CuttingToolLifeCycle><ToolLife countDirection="UP" limit="0" type="MINUTES">160</ToolLife>' +
  '<Location type="POT">10</Location><Measurements><FunctionalLength code="LF" minimum="0" nominal="3.7963">3.7963</FunctionalLength>' +
  '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>'
  const shdr4 = '2016-07-25T05:50:28.303002Z|@ASSET@|EM264|CuttingTool|<CuttingTool serialNumber="DEF" toolId="11" assetId="XYZ">' +
  '<Description></Description><CuttingToolLifeCycle><ToolLife countDirection="UP" limit="0" type="MINUTES">341</ToolLife>' +
  '<Location type="POT">11</Location><Measurements><FunctionalLength code="LF" minimum="0" nominal="4.12213">4.12213</FunctionalLength>' +
  '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>'
  before(()=>{
    ag.startAgent()
  })

  beforeEach(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    const jsonFile1 = fs.readFileSync('./test/support/VMC-4Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile1))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid1, uuid2])
    common.parsing(shdr1, uuid1)
    common.parsing(shdr2, uuid2)
  })

  afterEach(() => {
    stub.restore()
  })

  after(() =>{
    ag.stopAgent()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })

  it('/assets?type give all assets with the specified AssetType', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/assets?type=CuttingTool'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        const obj = parse(xml)
        const root = obj.root
        const child = root.children[1]
        const children = child.children
        expect(root.name).to.eql('MTConnectAssets')
        expect(child.name).to.eql('Assets')
        expect(children.length).to.eql(1)
        expect(children[0].attributes.assetId).to.eql('EM262')
        done()
      })
    })
  })

  it('/assets?type&count give \'count\' number of recent assets with the specified AssetType', (done) => {
    common.parsing(shdr3, uuid1)
    common.parsing(shdr4, uuid2)

    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/assets?type=CuttingTool&count=2'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        const obj = parse(xml)
        const root = obj.root
        const child = root.children[1]
        const children = child.children
        expect(root.name).to.eql('MTConnectAssets')
        expect(child.name).to.eql('Assets')
        expect(children.length).to.eql(2)
        expect(children[0].attributes.assetId).to.eql('EM264')  // make test independent of config val by stubbing.
        expect(children[1].attributes.assetId).to.eql('EM263')
        done()
      })
    })
  })

  it('/deviceName/assets?type&count give \'count\' number of recent assets associated with specified device and of specified type', function * () {
    const { body } = yield request('http://0.0.0.0:7000/VMC-4Axis/assets?type=CuttingTool&count=2')
    const xml = String(body)
    const obj = parse(xml)
    const root = obj.root
    const child = root.children[1]
    const children = child.children
    expect(root.name).to.eql('MTConnectAssets')
    expect(child.name).to.eql('Assets')
    expect(children.length).to.eql(1)
    expect(children[0].attributes.assetId).to.eql('EM262')
  })

  it('/assets?type&target gives all the assets associated with specified target and of specified type', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/assets?type=CuttingTool&target=VMC-4Axis'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        const obj = parse(xml)
        const root = obj.root
        const child = root.children[1]
        const children = child.children
        expect(root.name).to.eql('MTConnectAssets')
        expect(child.name).to.eql('Assets')
        expect(children.length).to.eql(1)
        expect(children[0].attributes.assetId).to.eql('EM262')
        done()
      })
    })
  })
})

describe('AssetErrors', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.assetBuffer.fill(null).empty()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub.restore()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashAdapters.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
  })
  it('/asset give empty asset response when no assets are present', (done) => {
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/assets/ST1'
    }

    http.get(options, (res) => {
      res.on('data', (chunk) => {
        const xml = String(chunk)
        const obj = parse(xml)
        const root = obj.root
        const child = root.children[1].children[0]
        const errorCode = child.attributes.errorCode
        const content = child.content

        expect(root.name).to.eql('MTConnectError')
        expect(errorCode).to.eql('ASSET_NOT_FOUND')
        expect(content).to.eql(`Could not find asset: ST1`)
        done()
      })
    })
  })
})

describe('current with interval', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub

  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub.restore()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
  })

  // checking Transfer-Encoding: chunked and boundary in MIME based stream.
  it('gives current response at the specified delay as chunked multipart message', (done) => {
    let stub2 = sinon.stub()
    const boundary = `\r\n--${md5(moment.utc().format())}\r\n`
    const contentType = `Content-type: text/xml\r\n`
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/current?interval=1000&path=//Axes//Linear[@name="X"]',
      headers: {
        'Content-type': 'application/json'
      }
    }

    // setTimeout(() => {
    //   //expect(stub2.callCount).to.eql(1)
    //   //expect(stub2.firstCall.args[0].toString()).to.eql(result)
    //   // expect(stub2.firstCall.args[0].toString()).to.eql(boundary)
    //   // expect(stub2.secondCall.args[0].toString()).to.eql(contentType)
    //   done()
    // }, 1000)

    http.get(options, (res) => {
      console.log(res.headers)
      res.once('data', function(data){
        console.log(data)
      })
    })
  })
})

describe('sample with interval', ()=>{
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  let stub

  before(() => {
    schemaPtr.clear()
    shdr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub.restore()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
  })

  it('should response at the specified delay as chunked multipart message', (done) => {
    let stub2 = sinon.stub()
    const boundary = `\r\n--${md5(moment.utc().format())}\r\n`
    const contentType = `Content-type: text/xml\r\n`
    const options = {
      hostname: ip.address(),
      port: 7000,
      path: '/sample?interval=1000&path=//Axes'
    }

    setTimeout(() => {
      //expect(stub2.firstCall.args[0].toString()).to.eql(boundary)
      //expect(stub2.secondCall.args[0].toString()).to.eql(contentType)
      expect(stub2.callCount).to.eql(1)
      done()
    }, 1000)

    http.get(options, (res) => {
      res.on('data', stub2)
    })
  })
})

describe('duplicateCheck()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const str = 'TIME|line|204'
  const str3 = 'TIME|line|204'
  const str4 = 'TIME|line|205'
  const name = 'Line'
  const url = `http://${ip.address()}:7000/sample?path=//Device[@name="VMC-3Axis"]//Path`
  let stub, dataItemId

  before(()=> {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    ag.startAgent()
  })

  after(()=> {
    ag.stopAgent()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.hashLast.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    stub.restore()
  })

  it('should return UNAVAILABLE for dataItemId cn4', function *(done) {
    const content = 'UNAVAILABLE'
    dataItemId = lokijs.getDataItem(uuid, 'line').$.id
    
    const { body } = yield request(url)
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0].children[0].children[1].children
    const line = R.filter(isLine, child)
    expect(line.length).to.eql(1)
    expect(line[0].name).to.eql(name)
    expect(line[0].attributes.dataItemId).to.eql(dataItemId)
    expect(line[0].content).to.eql(content)
    done()
  })

  it('should return 204 right after UNAVAILABLE for dataItemId cn4', function *(done) {
    common.parsing(str, uuid)
    const content = '204'
    
    const { body } = yield request(url)
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0].children[0].children[1].children
    const line = R.filter(isLine, child)
    expect(line.length).to.eql(2)
    expect(line[1].name).to.eql(name)
    expect(line[1].attributes.dataItemId).to.eql(dataItemId)
    expect(line[0].content).to.eql('UNAVAILABLE')
    expect(line[1].content).to.eql(content)
    done()
  })

  it('should ignore TIME|line|204 and only insert TIME|line|205', function*(done){
    common.parsing(str3, uuid)
    common.parsing(str4, uuid)
    const content = '205'

    const { body } = yield request(url)
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0].children[0].children[1].children
    const line = R.filter(isLine, child)
    expect(line.length).to.eql(3)
    expect(line[2].name).to.eql(name)
    expect(line[2].attributes.dataItemId).to.eql(dataItemId)
    expect(line[0].content).to.eql('UNAVAILABLE')
    expect(line[1].content).to.eql('204')
    expect(line[2].content).to.eql(content)
    done()
  })
})

describe.skip('autoAvailable()', () => {
  it('', () => {
  })
})

describe.skip('multipleDisconnect()', () => {
  it('', () => {
  })
})

describe('ignoreTimestamps()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const str = 'TIME|line|204'
  const str2 = 'TIME|line|205'
  const url = `http://${ip.address()}:7000/sample?path=//Device[@name="VMC-3Axis"]//Path`
  let stub

  before(()=> {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    ag.startAgent()
  })

  after(()=> {
    ag.stopAgent()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashAdapters.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
    stub.restore()
  })

  it('should return timestamp=TIME from TIME|line|204', function *(done) {
    common.parsing(str, uuid)

    const { body } = yield request(url)
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0].children[0].children[1].children
    const line = R.filter(isLine, child)
    expect(line.length).to.eql(2)
    expect(line[0].content).to.eql('UNAVAILABLE')
    expect(line[1].attributes.timestamp).to.eql('TIME')
    done()
  })

  it('should ignore TIME at TIME|line|205', function *(done){
    const device = lokijs.getSchemaDB().data[0].device
    dataStorage.setConfiguration(device, 'IgnoreTimestamps', true)
    common.parsing(str2, uuid)
    
    const { body } = yield request(url)
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0].children[0].children[1].children
    const line = R.filter(isLine, child)
    
    expect(line.length).to.eql(3)
    expect(line[0].content).to.eql('UNAVAILABLE')
    expect(line[1].attributes.timestamp).to.eql('TIME')
    expect(line[2].attributes.timestamp).not.to.eql('TIME')
    done()
  })
})

describe('storeAsset()', () => {
  let stub
  const reqPath = '/assets/KSSP300R.1?type=CuttingTool&device=VMC-3Axis'
  const reqXml = fs.readFileSync(`${__dirname}/support/cutting_tool_post.xml`)
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(uuidCollection)
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub.restore()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })

  it('stores the asset received from PUT enabled devices', function * putAsset () {
    const { body } = yield request({
      url: `http://0.0.0.0:7000${reqPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: reqXml
    })

    expect(body).to.eql('<success/>\r\n')
  })

  it('/assets will show the newly added', function *(done) {
    const { body } = yield request(`http://${ip.address()}:7000/assets`)
    const obj = parse(body)
    let root = obj.root
    let child = root.children[1].children[0]
    expect(child.name).to.eql('CuttingTool')
    expect(child.attributes.assetId).to.eql('KSSP300R.1')
    done()
  })
})

describe.skip('test PUT blocking', () => {
  let stub
  const url = '/VMC-3Axis?time=TIME&line=205&power=ON'
  let assetBody

  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.assetBuffer.fill(null).empty()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns(uuidCollection)
    ag.startAgent()
  })

  after(() => {
    ag.stopAgent()
    stub.restore()
    dataStorage.assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })

  it('returns Only the HTTP GET request is supported', function *(done){
    const { body } = yield request({
      url: `http://0.0.0.0:7000${url}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: assetBody
    })
    console.log(body)
  })
})

describe.skip('veryLargeSequence()', () => {
  it('', (done) =>{
    done()
  })
})

describe.skip('statisticAndTimeSeriesProbe()', () => {
  it('', () => {
  })
})

describe.skip('nonPrintableCharacters()', () => {
  it('', () => {
  })
})
