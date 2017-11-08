/* global describe, it, before, after */
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
const R = require('ramda')
const sinon = require('sinon')

// Imports - Internal

const lokijs = require('../src/lokijs')
const dataStorage = require('../src/dataStorage')
const common = require('../src/common')
const ioEntries = require('./support/ioEntries')
const log = require('../src/config/logger')
const config = require('../src/config/config')
// constants

const shdr = lokijs.getRawDataDB()
const schemaPtr = lokijs.getSchemaDB()
const cbPtr = dataStorage.circularBuffer
const bufferSize = config.app.agent.bufferSize
const arrToPathFilter = ioEntries.arrToPathFilter
const assetData = ioEntries.assetData
const output2 = { Event:
[{ Availability:
{ $: { dataItemId: 'avail', sequence: 0, timestamp: '2' },
  _: 'AVAILABLE' } },
{ EmergencyStop:
{ $: { dataItemId: 'estop', sequence: 1, timestamp: '2' },
  _: 'TRIGGERED' } }],
  Sample:
  [{ Load:
  { $: { dataItemId: 'cl3', sequence: 3, timestamp: '2', name: 'Cload' },
    _: 'UNAVAILABLE' } }],
  Condition:
  [{ Normal:
  { $:
  { dataItemId: 'Xloadc',
    sequence: 4,
    timestamp: '2',
    type: 'LOAD' } } }] }

const dataItemsArr = [{ $: { category: 'EVENT', id: 'avail', type: 'AVAILABILITY' } },
                      { $: { category: 'EVENT', id: 'estop', type: 'EMERGENCY_STOP' } },
  { $: { category: 'SAMPLE',
    id: 'cl3',
    name: 'Cload',
    nativeUnits: 'PERCENT',
    type: 'LOAD',
    units: 'PERCENT' } },
                      { $: { category: 'CONDITION', id: 'Xloadc', type: 'LOAD' } }]

const idVal = 'dtop_2'
const uuidVal = '000'
//const hashLastArr = ['dev_dtop_2', 'dev_dtop_3', 'dev_asset_chg', 'dev_asset_rem']
const hashLastArr = ['ifdFcfPh1C', 'BA3qjkMgS5', 'CQeVl0V5Yg', 'aQDjJbsJMQ']

describe('readFromHashCurrent()', () => {
  describe('searches circularBuffer for matching keys', () => {
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
    it('gives the recent entry if present', () => {
      shdr.insert({ sequenceId: 0,
        id: idVal,
        uuid: uuidVal,
        time: '2',
        dataItemName: 'avail',
        value: 'CHECK' })
      const result = dataStorage.readFromHashCurrent(idVal)
      expect(result.value).to.eql('CHECK')
    })
    it('gives undefined if absent', () => {
      const result = dataStorage.readFromHashCurrent('garbage')
      expect(result).to.eql(undefined)
    })
  })
})

describe('hashLast is updated when the circular buffer overflows', () => {
  describe('readFromHashLast() searches hashLast for matching keys', () => {
    const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
    before(() => {
      shdr.clear()
      schemaPtr.clear()
      cbPtr.fill(null).empty()
      dataStorage.hashLast.clear()
      dataStorage.hashCurrent.clear()
      dataStorage.hashDataItemsByName.clear()
    })

    after(() => {
      dataStorage.hashCurrent.clear()
      dataStorage.hashLast.clear()
      cbPtr.fill(null).empty()
      schemaPtr.clear()
      shdr.clear()
    })

    it('initially it will have an entry for all dataItem with value UNAVAILABLE', () => {
      const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8')
      lokijs.insertSchemaToDB(JSON.parse(jsonFile))
      const id = lokijs.getDataItem(uuid, 'avail').$.id
      const test1 = dataStorage.readFromHashLast(id)
      expect(dataStorage.hashLast.keys()).to.eql(hashLastArr)
      expect(test1.value).to.eql('UNAVAILABLE')
    })
    it('gives the dataItem present in hashLast for the id', () => {
      for (let i = 1, size = config.app.agent.bufferSize + 1; i <= size; i++) {
        shdr.insert({ sequenceId: 0,
          id: `id${i}`,
          uuid: uuidVal,
          time: '2',
          dataItemName: 'avail',
          value: `CHECK${i}`
        })
      }
      const result = dataStorage.readFromHashLast('id1')
      expect(result.value).to.eql('CHECK1')
    })
    it('gives undefined if absent', () => {
      const result = dataStorage.readFromHashCurrent('garbage')
      expect(result).to.eql(undefined)
    })
  })
})

describe('readFromCircularBuffer()', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  describe('searches circularBuffer for given sequenceId if present in it', () => {
    before(() => {
      shdr.clear()
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
      shdr.clear()
    })

    it('gives the recent entry if present ', () => {
      const id = lokijs.getDataItem(uuid, 'avail').$.id
      shdr.insert({ sequenceId: 0,
        id,
        uuid,
        time: '2',
        dataItemName: 'avail',
        value: 'ONE' })
      const result = dataStorage.readFromCircularBuffer(0, id, uuid)
      return expect(result.value).to.eql('ONE')
    })
    it('gives ERROR if sequenceId is out of range', () => {
      const result = dataStorage.readFromCircularBuffer(4, 'garbage', uuid)
      return expect(result).to.eql('ERROR')
    })

    it('slice the circularBuffer considering the checkPoint value', () => {
      const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8')
      lokijs.insertSchemaToDB(JSON.parse(jsonFile))
      shdr.insert({ sequenceId: 1000,
        id: lokijs.getDataItem(uuid, 'avail').$.id,
        uuid,
        time: '2',
        dataItemName: 'avail',
        value: 'TWO' })
      shdr.insert({ sequenceId: 2000,
        id: lokijs.getDataItem(uuid, 'estop').$.id,
        uuid,
        time: '2',
        dataItemName: 'estop',
        value: 'THREE' })
      shdr.insert({ sequenceId: 3000,
        id: lokijs.getDataItem(uuid, 'avail').$.id,
        uuid,
        time: '2',
        dataItemName: 'avail',
        value: 'FOUR' })
      shdr.insert({ sequenceId: 4000,
        id: lokijs.getDataItem(uuid, 'estop').$.id,
        uuid,
        time: '2',
        dataItemName: 'estop',
        value: 'FIVE' })
      shdr.insert({ sequenceId: 5000,
        id: lokijs.getDataItem(uuid, 'assetChange').$.id,
        uuid,
        time: '2',
        dataItemName: 'assetChange',
        value: 'FIVE' })
      shdr.insert({ sequenceId: 6000,
        id: lokijs.getDataItem(uuid, 'assetRemove').$.id,
        uuid,
        time: '2',
        dataItemName: 'assetRemove',
        value: 'FIVE' })
      const id = lokijs.getDataItem(uuid, 'assetRemove').$.id
      const cbArr1 = cbPtr.toArray()
      expect(cbArr1[cbArr1.length - 1].checkPoint).to.eql(3000)
      const result = dataStorage.readFromCircularBuffer(6000, id, uuid)
      expect(result.id).to.eql(id)
    })
  })
})

describe('circularBuffer.overflow is called', () => {
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
  describe('when buffer is full and a new data comes', () => {
    it('the evicted data will be stored in hash map', () => {
      shdr.insert({
        sequenceId: 1,
        id: 'dtop_1',
        uuid: uuidVal,
        time: '2016-07-25T05:50:19.303002Z',
        dataItemName: 'estop',
        value: 'TRIGGERED'
      })
      shdr.insert({ sequenceId: 0,
        id: idVal,
        uuid: uuidVal,
        time: '2016-07-25T05:50:19.303002Z',
        dataItemName: 'avail',
        value: 'AVAILABLE'
      })

      for (let i = 0; i < bufferSize; i++) {
        shdr.insert({
          sequenceId: i,
          id: idVal,
          uuid: uuidVal,
          time: '2016-07-25T05:50:19.303002Z',
          dataItemName: 'avail',
          value: 'UNAVAILABLE'
        })
      }

      expect(dataStorage.hashLast.get('dtop_2').value).to.eql('AVAILABLE')
      expect(dataStorage.hashLast.get('dtop_1').value).to.eql('TRIGGERED')
    })
  })
})

describe('categoriseDataItem() categorises the dataItem', () => {
  describe('into SAMPLE, EVENT, CONDITION', () => {
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

    it('and gives latest value of each dataItem', () => {
      shdr.insert({ sequenceId: 0,
        id: 'avail',
        uuid: uuidVal,
        time: '2',
        value: 'AVAILABLE' })
      shdr.insert({ sequenceId: 1,
        id: 'estop',
        uuid: uuidVal,
        time: '2',
        value: 'TRIGGERED' })
      shdr.insert({ sequenceId: 3,
        id: 'cl3',
        uuid: uuidVal,
        time: '2',
        value: 'UNAVAILABLE' })
      shdr.insert({ sequenceId: 4,
        id: 'Xloadc',
        uuid: uuidVal,
        time: '2',
        value: 'NORMAL' })

      const result = dataStorage.categoriseDataItem(ioEntries.schema, dataItemsArr)
      expect(result).to.eql(output2)
    })
  })
})

describe('pascalCase()', () => {
  let spy
  before(() => {
    spy = sinon.spy(log, 'error')
  })

  after(() => {
    log.error.restore()
  })

  it('converts the string to pascal case', () => {
    var testStrings = [];
    // Each entry in testStrings should be the input and expected output
    testStrings.push(["hello_world", "HelloWorld"]);
    testStrings.push(["helloworld", "Helloworld"]);
    testStrings.push(["x:helloworld", "Helloworld"]);
    testStrings.push(["DATA_ITEM_LONG_NAME", "DataItemLongName"]);
    testStrings.push(["x:DATA_ITEM_LONG_NAME", "DataItemLongName"]);
    testStrings.push(["name_with_a__double_underscore", "NameWithADoubleUnderscore"]);
    testStrings.push(["_DATA_ITEM", "DataItem"]);
    
    for (let i = 0; i < testStrings.length; i++) {
      expect(dataStorage.pascalCase(testStrings[i][0])).to.eql(testStrings[i][1])
    }

    dataStorage.pascalCase(undefined)
    expect(spy.callCount).to.be.equal(1)
  })
})

describe('checkPoint is updated on inserting data to database', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
  })

  after(() => {
    dataStorage.hashCurrent.clear()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })

  it('gives hashLast as the checkpoint when the first data is being inserted ', () => {
    const jsonFile = fs.readFileSync('./test/support/jsonFile', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    const cbArr = cbPtr.toArray()
    expect(cbArr[0].checkPoint).to.eql(-1)
  })
  it('gives the CheckPoint as \'null\' if sequenceId is not multiple of CheckPointIndex', () => {
    shdr.insert({ sequenceId: 3,
      id: lokijs.getDataItem(uuid, 'estop').$.id,
      uuid,
      time: '2',
      value: 'AVAILABLE' })
    expect(cbPtr.data[2].checkPoint).to.eql(null)
  })
  it('gives hashLast as the checkpoint if atleast one of the dataItem is not present in CB', () => {
    shdr.insert({ sequenceId: 1000,
      id: lokijs.getDataItem(uuid, 'estop').$.id,
      uuid,
      time: '2',
      value: 'AVAILABLE' })
    for(let i = 4; i < bufferSize; i++){
      let id
      switch(i){
        case 4:
          id = lokijs.getDataItem(uuid, 'assetRemove').$.id
          break
        case 5:
          id = lokijs.getDataItem(uuid, 'assetChange').$.id
          break
        default:
          id = lokijs.getDataItem(uuid, 'estop').$.id
      }
      shdr.insert({ sequenceId: i,
      id: id,
      uuid,
      time: '2',
      value: 'AVAILABLE' })
    }
    shdr.insert({ sequenceId: 2000,
      id: lokijs.getDataItem(uuid, 'estop').$.id,
      uuid,
      time: '2',
      value: '11' })
    const cbArr1 = cbPtr.toArray()
    expect(cbArr1[cbArr1.length - 1].checkPoint).to.eql(-1)
  })
  
  it('gives the least sequenceId if all the dataItems are present in circular buffer', () => {
    shdr.insert({ sequenceId: 3000,
      id: lokijs.getDataItem(uuid, 'avail').$.id,
      uuid: uuid,
      time: '2',
      value: '11' })
    const cbArr2 = cbPtr.toArray()
    expect(cbArr2[cbArr2.length - 1].checkPoint).to.eql(4) 

    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    dataStorage.hashCurrent.clear()
    dataStorage.hashDataItemsByName.clear()

    const jsonFile = fs.readFileSync('./test/support/vmc_8di', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    const arr = ['avail', 'Sspeed', 'assetChange', 'assetRemove', 'block', 'Frt', 'msg']
    let id, i = 1000
    
    R.map((str) => {
      id = lokijs.getDataItem(uuid, str).$.id
      
      shdr.insert({ sequenceId: i,
      id,
      uuid,
      time: '2',
      value: 'AVAILABLE' })
      
      i += 1000
    }, arr)
    
    shdr.insert({ sequenceId: 8000,
      id: lokijs.getDataItem(uuid, 'power').$.id,
      uuid,
      time: '2',
      value: 'LAST' })
    shdr.insert({ sequenceId: 9000,
      id: lokijs.getDataItem(uuid, 'clow').$.id,
      uuid,
      time: '2',
      value: '11' })
    shdr.insert({ sequenceId: 10000,
      id: lokijs.getDataItem(uuid, 'hlow').$.id,
      uuid,
      time: '2',
      value: '11' })
    const cbArr = cbPtr.toArray()
    expect(cbArr[cbArr.length - 1].checkPoint).to.eql(1000)
    shdr.insert({ sequenceId: 1000,
      id: lokijs.getDataItem(uuid, 'avail').$.id,
      uuid,
      time: '2',
      value: 'AVAILABLE' })
    const cbArr1 = cbPtr.toArray()
    expect(cbArr1[cbArr1.length - 1].checkPoint).to.eql(2000)
  })
})

describe('getRecentDataItemForSample create a sub array slicing circularBuffer', () => {
  describe('depending on the from and count value', () => {
    before(() => {
      shdr.clear()
      schemaPtr.clear()
      cbPtr.fill(null).empty()
      dataStorage.hashCurrent.clear()
      shdr.insert({ sequenceId: 1,
        id: 'dtop_2',
        uuid: uuidVal,
        time: '2',
        value: 'ONE' })
      shdr.insert({ sequenceId: 2,
        id: 'dtop_3',
        uuid: uuidVal,
        time: '2',
        value: 'TWO' })
      shdr.insert({ sequenceId: 3,
        id: 'dtop_2',
        uuid: uuidVal,
        time: '2',
        value: 'THREE' })
      shdr.insert({ sequenceId: 4,
        id: 'dtop_3',
        uuid: uuidVal,
        time: '2',
        value: 'FOUR' })
      shdr.insert({ sequenceId: 5,
        id: 'dtop_2',
        uuid: uuidVal,
        time: '2',
        value: 'FIVE' })
      shdr.insert({ sequenceId: 6,
        id: 'dtop_3',
        uuid: uuidVal,
        time: '2',
        value: 'SIX' })
      shdr.insert({ sequenceId: 7,
        id: 'dtop_3',
        uuid: uuidVal,
        time: '2',
        value: 'SEVEN' })
      shdr.insert({ sequenceId: 8,
        id: 'dtop_2',
        uuid: uuidVal,
        time: '2',
        value: 'EIGHT' })
      shdr.insert({ sequenceId: 9,
        id: 'dtop_2',
        uuid: uuidVal,
        time: '2',
        value: 'NINE' })
      shdr.insert({ sequenceId: 10,
        id: 'dtop_3',
        uuid: uuidVal,
        time: '2',
        value: 'TEN' })
    })

    after(() => {
      cbPtr.fill(null).empty()
      schemaPtr.clear()
      shdr.clear()
    })

    it('from and from+count within the range', () => {
      const result = dataStorage.getRecentDataItemForSample(7, 'dtop_3', '000', 3)
      expect(result[0].sequenceId).to.eql(7)
      expect(result.length).to.eql(1)
    })
    it('from value outside the range', () => {
      const result = dataStorage.getRecentDataItemForSample(11, 'dtop_3', '000', 3)
      expect(result).to.eql('ERROR')
    })
    it('from+count is outside the range', () => {
      const result = dataStorage.getRecentDataItemForSample(7, 'dtop_3', '000', 4)
      expect(result[0].sequenceId).to.eql(7)
      expect(result[1].sequenceId).to.eql(10)
    })
  })
})

describe('filterPath() filters the given array', () => {
  it('returns the array of dataItems with matching path', () => {
    const path = '//Device[@name="VMC-3Axis"]//Axes//DataItem[@type="POSITION"and@subType="ACTUAL"]'
    const result = dataStorage.filterPath(arrToPathFilter, path)
    const path1 = '//Device[@name="VMC-3Axis"]//Axes//DataItem[@type="POSITION"]'
    const result1 = dataStorage.filterPath(arrToPathFilter, path1)

    expect(result.length).to.eql(1)
    expect(result[0].dataItemName).to.eql('Yact')
    expect(result1.length).to.eql(2)
    expect(result1[1].dataItemName).to.eql('Xact')
  })
  it('returns empty array if no element have matching path', () => {
    const path = '//Device[@name="VMC-3Axis"]//Axes//DataItem[@type="GARBAGE"]'
    const result = dataStorage.filterPath(arrToPathFilter, path)
    expect(result.length).to.eql(0)
  })
})

describe('createDataItemForEachId()', () => {
  const recentDataEntry = [{ dataItemName: undefined,
    uuid: '000',
    id: 'x2',
    value: '29',
    sequenceId: 917,
    time: '2016-07-25T05:50:23.303002Z',
    path: '//Devices//Device[@name="VMC-3Axis"]//Axes//Linear//DataItem[@type="POSITION" and @subType="ACTUAL"]',
    checkPoint: null }]
  const recentDataEntry1 = [{ dataItemName: undefined,
    uuid: '000',
    id: 'htemp',
    value: [ 'WARNING', 'HTEMP', '1', 'HIGH', 'Oil Temperature High' ],
    sequenceId: 1720,
    time: '2010-09-29T23:59:33.460470Z',
    path: '//Devices//Device[@name="VMC-3Axis"]//Systems//Hydraulic//DataItem[@type="TEMPERATURE"]',
    checkPoint: null }]
  const category = 'SAMPLE'
  const data = { category: 'SAMPLE',
    id: 'x2',
    name: 'Xact',
    nativeUnits: 'MILLIMETER',
    subType: 'ACTUAL',
    type: 'POSITION',
    units: 'MILLIMETER' }

  const data2 = { dataItemName: undefined,
    uuid: '000',
    id: 'htemp',
    value: [ 'WARNING', 'HTEMP', '1', 'HIGH', 'Oil Temperature High' ],
    sequenceId: 1597,
    time: '2010-09-29T23:59:33.460470Z',
    path: '//Devices//Device[@name="VMC-3Axis"]//Systems//Hydraulic//DataItem[@type="TEMPERATURE"]',
    checkPoint: null }
  const expectedResult = [{ Position:
  { $:
  { dataItemId: 'x2',
    timestamp: '2016-07-25T05:50:23.303002Z',
    sequence: 917,
    name: 'Xact',
    subType: 'ACTUAL' },
    _: '29' } }]
  const expectedResult2 = [ { Warning:
  { '$':
  { dataItemId: 'htemp',
    timestamp: '2010-09-29T23:59:33.460470Z',
    sequence: 1720,
    type: undefined,
    nativeCode: 'HTEMP',
    nativeSeverity: '1',
    qualifier: 'HIGH' },
    _: 'Oil Temperature High' } } ]
  it('creates the dataItem in the required format', () => {
    const result = dataStorage.createDataItemForEachId(recentDataEntry, data, category)
    const result2 = dataStorage.createDataItemForEachId(recentDataEntry1, data2, 'CONDITION')
    expect(result).to.eql(expectedResult)
    expect(result2).to.eql(expectedResult2)
  })
})

describe('getSequence()', () => {
  describe(' calculates and give the firstSequence and lastSequence', () => {
    let spy
    before(() => {
      shdr.clear()
      schemaPtr.clear()
      cbPtr.fill(null).empty()
      dataStorage.hashLast.clear()
      dataStorage.hashCurrent.clear()
      spy = sinon.spy(log, 'error')
    })

    after(() => {
      log.error.restore()
      dataStorage.hashCurrent.clear()
      dataStorage.hashLast.clear()
      cbPtr.fill(null).empty()
      schemaPtr.clear()
      shdr.clear()
    })

    it('gives error message if the circularBuffer is empty', () => {
      dataStorage.getSequence()
      expect(spy.callCount).to.be.equal(1)
    })

    it('gives the firstSequence and lastSequence when circularBuffer is non empty', () => {
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
      const obj = dataStorage.getSequence()
      expect(obj.firstSequence).to.eql(1)
      expect(obj.lastSequence).to.eql(2)
    })
  })
})

describe('Assets when received are added', () => {
  const uuid = '43444e50-a578-11e7-a3dd-28cfe91a82ef'
  const shdr1 = '2|@ASSET@|EM233|CuttingTool|<CuttingTool serialNumber="ABC" toolId="10" assetId="ABC">' +
  '<Description></Description><CuttingToolLifeCycle><ToolLife countDirection="UP" limit="0" type="MINUTES">160</ToolLife>' +
  '<Location type="POT">10</Location><Measurements><FunctionalLength code="LF" minimum="0" nominal="3.7963">3.7963</FunctionalLength>' +
  '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>'
  const assetBuffer = dataStorage.assetBuffer
  let stub
  before(() => {
    shdr.clear()
    schemaPtr.clear()
    cbPtr.fill(null).empty()
    assetBuffer.fill(null).empty()
    dataStorage.hashAssetCurrent.clear()
    dataStorage.hashAdapters.clear()
    const jsonFile = fs.readFileSync('./test/support/VMC-3Axis.json', 'utf8')
    lokijs.insertSchemaToDB(JSON.parse(jsonFile))
    stub = sinon.stub(common, 'getAllDeviceUuids')
    stub.returns([uuid])
    common.parsing(shdr1, uuid) 
  })

  after(() => {
    stub.restore()
    dataStorage.hashAssetCurrent.clear()
    assetBuffer.fill(null).empty()
    cbPtr.fill(null).empty()
    schemaPtr.clear()
    shdr.clear()
  })

  it('to assetBuffer', () => {
    expect(assetBuffer.length).to.eql(1)
  })

  it('to hashAssetCurrent', () => {
    expect(dataStorage.hashAssetCurrent.has('EM233')).to.eql(true)
  })
})

// filterAssets(assetData, type, count, removed, target, archetypeId)
describe('filterAsset() filters the assets based on the parameters and sorts by time', () => {
  const assetBuffer = dataStorage.assetBuffer
  it('"type" gives only assets of specified assetType', () => {
    const type = 'CuttingTool'
    const result = dataStorage.filterAssets(assetData, type)
    expect(result.length).to.eql(1)
    expect(result[0].assetId).to.eql('EM233')
  })

  it('"removed = true" gives assets which were removed along with active assets', () => {
    const result = dataStorage.filterAssets(assetData, undefined, undefined, true)
    expect(result.length).to.eql(3)
    expect(result[0].assetId).to.eql('EM262')
    expect(result[1].assetId).to.eql('ST1')
    expect(result[2].assetId).to.eql('EM233')
  })

  it('"removed = false" gives only active assets', () => {
    const result = dataStorage.filterAssets(assetData, undefined, undefined, false)
    expect(result.length).to.eql(2)
    expect(result[0].assetId).to.eql('EM262')
    expect(result[1].assetId).to.eql('EM233')
  })

  it('"type and removed = true" gives the assets of specified assetType which are active or removed', () => {
    const result = dataStorage.filterAssets(assetData, 'CuttingTool', undefined, true)
    expect(result.length).to.eql(2)
    expect(result[0].assetId).to.eql('ST1')
    expect(result[1].assetId).to.eql('EM233')
  })

  it('"type, count and removed = true" gives the "count" number of recent assets of specified assetType which are active or removed', () => {
    R.map((k) => {
      assetBuffer.push(k)
      return k
    }, assetData)
    const result = dataStorage.filterAssets(assetData, 'CuttingTool', 1, true)
    expect(result.length).to.eql(1)
    expect(result[0].assetId).to.eql('ST1')
  })

  it('"target" gives the assets connected to target device', () => {
    const result = dataStorage.filterAssets(assetData, undefined, undefined, false, 'VMC-3Axis')
    expect(result.length).to.eql(2)
    expect(result[0].assetId).to.eql('EM262')
    expect(result[1].assetId).to.eql('EM233')
    const result1 = dataStorage.filterAssets(assetData, undefined, undefined, true, 'ABC')
    expect(result1.length).to.eql(1)
    expect(result1[0].assetId).to.eql('ST1')
  })
})
