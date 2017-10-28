/* global before, after, it, describe */
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
const fs = require('fs')
const sinon = require('sinon')
const moment = require('moment')
// Imports - Internal

const ioEntries = require('./support/ioEntries')
const dataStorage = require('../src/dataStorage')
const dataItemjs = require('../src/dataItem')
const lokijs = require('../src/lokijs')
const sameJSON = require('./support/sampleJSONOutput')
const differentJSON = require('./support/sampleJSONEdited')
const dataItem = require('./support/dataItem')
const log = require('../src/config/logger')
const config = require('../src/config/config')
// constants

const cbPtr = dataStorage.circularBuffer
const schemaPtr = lokijs.getSchemaDB()
const rawData = lokijs.getRawDataDB()
const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
const bufferSize = dataStorage.bufferSize
const result1 = { time: '2014-08-11T08:32:54.028533Z',
  dataitem: [{ name: 'avail', value: 'AVAILABLE' }] }

const input1 = ioEntries.input1
const dbResult1 = [{ dataItemName: 'avail',
  uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef',
  id: 'ifdFcfPh1C',
  value: 'AVAILABLE',
  sequenceId: 6,
  time: '2014-08-11T08:32:54.028533Z' }]

const insertedObject = {
  xmlns: { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    xmlns: 'urn:mtconnect.org:MTConnectDevices:1.3',
    'xmlns:m': 'urn:mtconnect.org:MTConnectDevices:1.3',
    'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectDevices:1.3 http://www.mtconnect.org/schemas/MTConnectDevices_1.3.xsd' },
  time: '2013-02-11T12:12:57Z',
  uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef',
  device: { $:
  { name: 'VMC-3Axis',
    uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef',
    id: 'dev' },
    Description:
   [{ $: { manufacturer: 'SystemInsights' } }],
    DataItems:
    [{ DataItem:
    [{ $:
    { type: 'AVAILABILITY',
      category: 'EVENT',
      id: 'ifdFcfPh1C',
      name: 'avail' } },
    { $:
    { type: 'EMERGENCY_STOP',
      category: 'EVENT',
      id: 'BA3qjkMgS5',
      name: 'estop' } },
    { $:
    { category: 'EVENT',
      id: 'CQeVl0V5Yg',
      name: 'assetChange',
      type: 'ASSET_CHANGED' } },
    { $:
    { category: 'EVENT',
      id: 'aQDjJbsJMQ',
      name: 'assetRemove',
      type: 'ASSET_REMOVED' } }
    ] }] }
}

// test - insertSchemaToDB()

describe('insertSchematoDB()', () => {
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
  })

  after(() => {
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
  })
  describe('inserts the device schema', () => {
    it('into the database ', () => {
      const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8')
      lokijs.insertSchemaToDB(JSON.parse(jsonFile))
      const checkData = schemaPtr.data[0]

      expect(checkData.xmlns).to.eql(insertedObject.xmlns)
      expect(checkData.time).to.eql(insertedObject.time)
      expect(checkData.uuid).to.eql(insertedObject.uuid)
      expect(checkData.device).to.eql(insertedObject.device)
    })
  })
})

describe('getId()', () => {
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
  })

  after(() => {
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
  })
  describe('checks the schema for each dataItemName', () => {
    it('gives the Id if present', () => {
      const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8')
      lokijs.insertSchemaToDB(JSON.parse(jsonFile))
      expect(lokijs.getDataItem(uuid, 'avail').$.id).to.eql('ifdFcfPh1C')
      expect(lokijs.getDataItem(uuid, 'estop').$.id).to.eql('BA3qjkMgS5')
    })
  })
})

// test - compareschema()

describe('compareSchema()', () => {
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
  })

  after(() => {
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
  })
  describe('checks the database for duplicate entry', () => {
    it('with duplicate entry', () => {
      const check = lokijs.compareSchema(ioEntries.schema, sameJSON)
      expect(check).to.eql(true)
    })
    it('without duplicate entry', () => {
      const check = lokijs.compareSchema(ioEntries.schema, differentJSON)
      const check1 = lokijs.compareSchema(ioEntries.schemaTimeDiff, sameJSON)
      expect(check).to.eql(false)
      expect(check1).to.eql(false)
    })
  })
})

describe('searchDeviceSchema()', () => {
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    dataStorage.hashAdapters.clear()
    cbPtr.fill(null).empty()
  })

  after(() => {
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
  })
  describe('checks the database for the latest', () => {
    it('device schema present for given uuid', () => {
      const xml1 = fs.readFileSync('./test/support/Devices2di.xml', 'utf8')
      lokijs.updateSchemaCollection(xml1)
      const schema = lokijs.searchDeviceSchema(uuid)
      const refSchema = ioEntries.refSchema[0]
      return expect(schema[0].device).to.eql(refSchema.device)
    })
  })
})

describe('On receiving new dataitems dataCollectionUpdate()', () => {
  describe('inserts to database and update circular buffer', () => {
    let schema, cb

    before(() => {
      rawData.clear()
      schemaPtr.clear()
      cbPtr.fill(null).empty()
      dataStorage.hashCurrent.clear()
      dataStorage.hashLast.clear()
      schema = fs.readFileSync('./test/support/Devices2di.xml', 'utf8')
      cb = dataStorage.circularBuffer
    })

    after(() => {
      dataStorage.hashLast.clear()
      dataStorage.hashLast.clear()
      cbPtr.fill(null).empty()
      schemaPtr.clear()
      rawData.clear()
    })
    
    it('with number of dataItem less than buffer size', () => {
      schemaPtr.clear()
      lokijs.updateSchemaCollection(schema)
      cbPtr.fill(null).empty()
      lokijs.dataCollectionUpdate(result1, uuid)
      const check1Obj = cb.toArray()
      expect(check1Obj[0].dataItemName).to.eql(dbResult1[0].dataItemName)
      expect(check1Obj[0].id).to.eql(dbResult1[0].id)
      expect(check1Obj[0].uuid).to.eql(dbResult1[0].uuid)
      return expect(check1Obj[0].value).to.eql(dbResult1[0].value)
    })
    it('with number of dataItem more than buffer size', () => {
      dataStorage.circularBuffer.empty()
      const dataObj = {
        type: input1.type,
        dataitem: input1.dataitem.slice(0, bufferSize)
      }
      lokijs.dataCollectionUpdate(dataObj, uuid)
      const check2Obj = cb.toArray()
      expect(check2Obj[0].value).to.eql('ZERO')
      expect(check2Obj[9].value).to.eql('EIGHT')
    })

    it('will not insert the dataItem to circular buffer if the value is same as previous entry', () => {
      const dataObj = {
        type: input1.type,
        dataitem: input1.dataitem.slice(0, bufferSize)
      }
      const len = dataObj.dataitem.length
      const value = dataObj.dataitem[len - 1].value
      const input = { time: '2014-08-11T08:32:54.028533Z',
        dataitem: [{ name: 'avail', value: value }] }
      lokijs.dataCollectionUpdate(input, uuid)
      const check3Obj = cb.toArray()
      expect(check3Obj[0].value).to.eql('ZERO')
      expect(check3Obj[9].value).to.eql('EIGHT')
    })

    it('will not increment sequenceId if the adjacent values are same', () => {
      const dataObj = {
        type: input1.type,
        dataitem: input1.dataitem.slice(0, bufferSize)
      }
      const len = dataObj.dataitem.length
      const value = dataObj.dataitem[len - 1].value
      const input = { time: '2', dataitem: [{ name: 'avail', value: value }] }
      lokijs.dataCollectionUpdate(input, uuid)
      const check3Obj = cb.toArray()
      const previousSequenceId = check3Obj[8].sequenceId
      const currentSequenceId = check3Obj[9].sequenceId
      expect(check3Obj[9].value).to.eql('EIGHT')
      expect(currentSequenceId).to.eql(previousSequenceId + 1)
    })
  })
})

describe('For dataItems with category as CONDITION', () => {
  const input = { time: '2010-09-29T23:59:33.460470Z',
        dataitem:
        [{ name: 'htemp',
          value: ['warning', 'HTEMP', '1', 'HIGH', 'Oil Temperature High'] }] }
  const input1 = { time: '2016-07-25T05:50:29.303002Z',
        dataitem: [{ name: 'clow', value: ['NORMAL', '', '', '', ''] }] }
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashAdapters.clear()
    const schema = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(schema)
    cbPtr.fill(null).empty()
  })

  after(() => {
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
    dataStorage.hashAdapters.clear()
  })

  describe('if the previous value and received value is same', () => {
    it('will add to buffer if the Level is anything other than NORMAL', () => {
      lokijs.dataCollectionUpdate(input, uuid)
      let check2Obj = cbPtr.toArray()
      expect(check2Obj[0].value[0]).to.eql('WARNING')
    })

    it('wont add to buffer duplicate', () => {
      lokijs.dataCollectionUpdate(input, uuid)
      check2Obj = cbPtr.toArray()
      expect(check2Obj.length).to.eql(1)
      expect(check2Obj[0].value[0]).to.eql('WARNING')
    })  
      
    it('will add to buffer if the Level is NORMAL', () => {
      cbPtr.empty()
      lokijs.dataCollectionUpdate(input1, uuid)
      let check2Obj = cbPtr.toArray()
      expect(check2Obj[0].value[0]).to.eql('NORMAL')
    })

    it('wont add duplicates', () => {
      lokijs.dataCollectionUpdate(input, uuid)
      check2Obj = cbPtr.toArray()
      expect(check2Obj.length).to.eql(1)
    })
  })
})

describe('Conversting dataItem Value', () => {
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashAdapters.clear()
    const schema = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
    lokijs.updateSchemaCollection(schema)
    cbPtr.fill(null).empty()
  })

  after(() => {
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
  })

  describe('conversionRequired', () => {
    it('specifies whether the value needs to be converted', () => {
      const dataItem1 = lokijs.getDataItem(uuid, 'Ppos')
      const dataItem2 = lokijs.getDataItem(uuid, 'htemp')
      const status1 = dataItemjs.conversionRequired(dataItem1)
      const status2 = dataItemjs.conversionRequired(dataItem2)
      expect(status1).to.eql(true)
      expect(status2).to.eql(false)
    })
  })
})

describe('On receiving a device schema', () => {
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
  })

  after(() => {
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
  })
  describe('updateSchemaCollection()', () => {
    it('adds a new device schema', () => {
      const schemaEntries = schemaPtr.data.length
      const schema = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
      lokijs.updateSchemaCollection(schema)
      return expect(schemaPtr.data.length).to.eql(schemaEntries + 1)
    })
    it('ignores if the schema already exist', () => {
      const schemaEntries = schemaPtr.data.length
      const schema = fs.readFileSync('./test/support/VMC-3Axis.xml', 'utf8')
      lokijs.updateSchemaCollection(schema)
      return expect(schemaPtr.data.length).to.eql(schemaEntries)
    })
    it('adds a new entry if it is an updated schema', () => {
      const schemaEntries = schemaPtr.data.length
      const schema = fs.readFileSync('./test/support/VMC-3Axis-copy.xml', 'utf8')
      lokijs.updateSchemaCollection(schema)
      expect(schemaPtr.data.length).to.eql(schemaEntries + 1)
      // schemaPtr.clear();
      // rawData.clear();
    })
  })
})

describe('Parsing the device schema for dataitems and components', () => {
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.hashDataItemsByName.clear()
  })

  after(() => {
    dataStorage.hashDataItemsByName.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
  })
  describe('and insert the dataitems into the rawData Collection', () => {
    it('with UNAVAILABLE as the default value except for constrained dataItems', () => {
      const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
      lokijs.insertSchemaToDB(JSON.parse(jsonFile))
      expect(rawData.maxId).to.eql(46)
      expect(rawData.data[5].value).to.eql('SPINDLE')
      expect(rawData.data[0].value).to.eql('UNAVAILABLE')
    })
  })
})

describe('getDataItem()', () => {
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
  })

  after(() => {
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
  })
  describe('get all the DataItems from the ', () => {
    it('latest device schema for given uuid', () => {
      const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
      lokijs.insertSchemaToDB(JSON.parse(jsonFile))
      const dataItemsArr = lokijs.getDataItems(uuid)
      expect(dataItemsArr.length).to.eql(46)
    })
  })
})

describe('hashCurrent()', () => {
  let availId, estopId
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
  })

  after(() => {
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
  })
  describe('is updated on each data insertion', () => {
    it('and has UNVAILABLE as value initially for all dataItems', () => {
      const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8')
      lokijs.insertSchemaToDB(JSON.parse(jsonFile))
      availId = lokijs.getDataItem(uuid, 'avail').$.id
      estopId = lokijs.getDataItem(uuid, 'estop').$.id
      const hC = dataStorage.hashCurrent
      const dataItem1 = hC.get(availId)
      const dataItem2 = hC.get(estopId)
      expect(dataItem1.value).to.eql('UNAVAILABLE')
      expect(dataItem2.value).to.eql('UNAVAILABLE')
    })
    it('Recent value is updated on receiving raw data from adapter', () => {
      rawData.insert({ sequenceId: 2, uuid, id: availId, time: '2013-02-11T12:12:57Z', value: 'AVAILABLE' })
      rawData.insert({ sequenceId: 3, uuid, id: estopId, time: '2013-02-11T12:12:57Z', value: 'TRIGGERED' })
      const hC = dataStorage.hashCurrent
      const dataItem1 = hC.get(availId)
      const dataItem2 = hC.get(estopId)
      expect(dataItem1.value).to.eql('AVAILABLE')
      expect(dataItem2.value).to.eql('TRIGGERED')
    })
  })
})

describe('rawDataInsert(), will check maxId and insert the object', () => {
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
  })

  after(() => {
    dataStorage.hashCurrent.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
  })

  it('if maxId is less than 1000', () => {
    for (let i = 0; i < 1000; i++) {
      lokijs.insertRawData({ sequenceId: i, uuid: '000', id: String(i), time: '2013-02-11T12:12:57Z', value: 'AVAILABLE' })
    }
    expect(rawData.maxId).to.eql(1000)
  })
  it('after clearing the database if maxId >= 1000', () => {
    lokijs.insertRawData({ sequenceId: 1000, uuid: '000', id: String(1000), time: '2013-02-11T12:12:57Z', value: 'AVAILABLE' })
    expect(rawData.maxId).to.eql(1)
  })
})

describe('updateBufferOnDisconnect()', () => {
  let availId, estopId, assetChgId, assetRemId
  before(() => {
    rawData.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.hashDataItemsByName.clear()
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    availId = lokijs.getDataItem(uuid, 'avail').$.id
    estopId = lokijs.getDataItem(uuid, 'estop').$.id
    assetChgId = lokijs.getDataItem(uuid, 'assetChange').$.id
    assetRemId = lokijs.getDataItem(uuid, 'assetRemove').$.id
    rawData.insert({ sequenceId: 13, uuid, id: estopId, time: '2', value: 'TRIGGERED' })
    rawData.insert({ sequenceId: 13, uuid, id: availId, time: '2', value: 'AVAILABLE' })
  })

  after(() => {
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashDataItemsByName.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
  })

  it('updates the value for all dataItems for tha device as UNAVAILABLE  in circularBuffer', () => {
    lokijs.updateBufferOnDisconnect(uuid)
    const bufferData = cbPtr.toArray()
    const length = bufferData.length
    expect(length).to.eql(8)
    expect(bufferData[length - 1].id).to.eql(estopId)
    expect(bufferData[length - 1].value).to.eql('UNAVAILABLE')
    expect(bufferData[length - 2].id).to.eql(availId)
    expect(bufferData[length - 2].value).to.eql('UNAVAILABLE')
  })

  it('updates the value for all dataItems for tha device as UNAVAILABLE  in hashCurrent', () => {
    const hC = dataStorage.hashCurrent
    const avail = hC.get(availId)
    const estop = hC.get(estopId)
    const assetChg = hC.get(assetChgId)
    const assetRem = hC.get(assetRemId)
    expect(avail.value).to.eql('UNAVAILABLE')
    expect(estop.value).to.eql('UNAVAILABLE')
    expect(assetChg.value).to.eql('UNAVAILABLE')
    expect(assetRem.value).to.eql('UNAVAILABLE')
    expect(avail.time).to.eql(estop.time)
    expect(avail.time).to.not.eql(assetChg.time)
    expect(assetChg.time).to.eql(assetRem.time)
  })

  it('does not update hashLast', () => {
    const hL = dataStorage.hashLast
    const avail = hL.get(availId)
    const estop = hL.get(estopId)
    const assetChg = hL.get(assetChgId)
    const assetRem = hL.get(assetRemId)
    expect(avail.value).to.eql('UNAVAILABLE')
    expect(estop.value).to.eql('UNAVAILABLE')
    expect(assetChg.value).to.eql('UNAVAILABLE')
    expect(assetRem.value).to.eql('UNAVAILABLE')
    expect(avail.time).to.eql(assetRem.time)
    expect(avail.time).to.eql(assetChg.time)
    expect(avail.time).to.eql(estop.time)
  })
})

describe('initiateCircularBuffer updates the circularBuffer', () => {
  let spy
  const dataItems = dataItem.dataItems
  const time = '2014-08-11T08:32:54.028533Z'

  before(() => {
    spy = sinon.stub(log, 'error')
    schemaPtr.clear()
    dataStorage.hashAdapters.clear()
    lokijs.setDefaultConfigsForDevice('VMC-3Axis')
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    cbPtr.fill(null).empty()
    rawData.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashLast.clear()
  })

  after(() => {
    log.error.restore()
    dataStorage.hashLast.clear()
    dataStorage.hashCurrent.clear()
    dataStorage.hashAdapters.clear()
    dataStorage.hashAdapters.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    rawData.clear()
  })

  it('skips the duplicate dataItem after checking for duplicate Id', () => {
    const device = lokijs.searchDeviceSchema(uuid)[0].device
    dataStorage.setConfiguration(device, 'FilterDuplicates', true)

    lokijs.initiateCircularBuffer(dataItems, uuid)
    expect(rawData.maxId).to.eql(47)
    lokijs.initiateCircularBuffer(dataItems, uuid)
    expect(rawData.maxId).to.eql(47) // not added again as already present
    expect(spy.callCount).to.be.equal(47)
  })
})

describe('getTime() gives time depending on the configuration', () => {
  let time2, result2
  
  const device = {
    '$': { id: 'dev', iso841Class: '6', name: 'VMC-3Axis', uuid }
  }

  before(() => {
    lokijs.setDefaultConfigsForDevice('VMC-3Axis')
  })

  after(() => {
    dataStorage.hashAdapters.clear()
  })
  
  it('when RelativeTime & mIgnoreTimestamp = false, gives adapter Time', () => {
    const time1 = '2016-12-08T07:29:53.246Z'
    const result1 = lokijs.getTime(time1, 'VMC-3Axis')
    expect(result1).to.eql(time1)
  })

  it('when ignoreTimestamps = true, RelativeTime = false, gives currentTime', () => {
    dataStorage.setConfiguration(device, 'IgnoreTimestamps', true)
    const time1 = '2016-12-08T07:29:53.246Z'
    const result1 = lokijs.getTime(time1, 'VMC-3Axis')
    expect(moment(result1).valueOf()).to.be.greaterThan(moment(time1).valueOf())
  })

  it('when RelativeTime = true and mBaseTime = 0, gives currentTime', () => {
    dataStorage.setConfiguration(device, 'IgnoreTimestamps', false)
    dataStorage.setConfiguration(device, 'RelativeTime', true)
    time2 = '2016-12-08T07:29:53.246Z'
    result2 = lokijs.getTime(time2, 'VMC-3Axis')
    expect(moment(result2).valueOf()).to.be.greaterThan(moment(time2).valueOf())
  })

  it('when  RelativeTime = true and mBaseTime != 0, gives relative time', () => {
    const time3 = '2016-12-08T07:30:53.246Z'
    const result3 = lokijs.getTime(time3, 'VMC-3Axis')
    const timeDiff = moment(time3).valueOf() - moment(time2).valueOf()
    const resDiff = moment(result3).valueOf() - moment(result2).valueOf()
    expect(timeDiff).to.eql(resDiff)
  })
})
