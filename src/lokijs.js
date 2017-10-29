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

// TODO: Use module import/export

// Imports - External

const Loki = require('lokijs')
const R = require('ramda')
const moment = require('moment')
const sha1 = require('sha1')
const uuidv5 = require('uuid/v5')

// Imports - Internal

const config = require('./config/config')
const dataStorage = require('./dataStorage')
const xmlToJSON = require('./xmlToJSON')
const dataItemjs = require('./dataItem.js')
const { genId } = require('./genIds')

const log = require('./config/logger')

// Instances
//const adapter = new lfsa()
const Db = new Loki('loki.json')

// Constants - datacollection pointers
const rawData = Db.addCollection('rawData')
const mtcDevices = Db.addCollection('DeviceDefinition')
const assetCollection = []
const joinValuesByComma = R.pipe(R.values, R.join(','))

// const mRealTime = config.getConfiguredVal('mRealTime');
// const FilterDuplicates = config.getConfiguredVal('FilterDuplicates');
// const AutoAvailable = config.getConfiguredVal('AutoAvailable');

// sequenceId starts from 1.
let sequenceId = 1 
let dataItemsArr = []
let d = 0
// let isFirst = 1       

/* ******************** handle to lokijs database ******************** */
/**
  * getSchemaDB() returns the deviceSchema
  * collection ptr in lokijs database
  *
  * @param = null
  */
function getSchemaDB () {
  return mtcDevices
}

/**
  * getRawDataDB() returns the SHDR collection
  * ptr in lokijs database
  *
  * @param = null
  */
function getRawDataDB () {
  return rawData
}

/* ********************** support functions *************************** */

function insertRawData (obj) { // TODO in future we should support moving window
  if (rawData.maxId >= 1000) {
    rawData.clear()
    rawData.insert(obj)
  } else {
    rawData.insert(obj)
  }
}

// check if the Id already exist
function checkDuplicateId (id) {
  const hC = dataStorage.hashCurrent
  return hC.has(id)
}

function getDeviceName (uuid) {
  const schemaDB = getSchemaDB()
  const schemaList = R.values(schemaDB.data)
  let deviceName
  R.find((k) => {
    if (k.uuid === uuid) {
      deviceName = k.name
    }
    return deviceName // eslint
  }, schemaList)
  return deviceName
}

function getTime(adTime, device){
  const adapter = dataStorage.hashAdapters.get(device)
  if (adapter.RelativeTime) {
    if (adapter.BaseTime === 0) {
      adapter.BaseTime = moment().valueOf()
      if (adTime.includes('T')) {
        adapter.ParseTime = true
        adapter.BaseOffset = moment(adTime).valueOf() // unix value of received time
      } else {
        adapter.BaseOffset = Number(adTime)
      }
      offset = 0
    } else if (adapter.ParseTime) {
      offset = moment(adTime).valueOf() - adapter.BaseOffset
    } else {
      offset = Number(adTime) - adapter.BaseOffset
    }   
    result = adapter.BaseTime + offset // unix time_utc
    result = moment(result).toISOString()
  } else if (adapter.IgnoreTimestamps || (adTime === '')) { // current time
    result = moment().toISOString()
  } else { // time from adapter
    result = adTime
  }

  dataStorage.hashAdapters.set(device, adapter)
  return result  
}

function getSequenceId () {
  const MAX_VAL = Number.MAX_SAFE_INTEGER // 9007199254740991
  if (sequenceId < MAX_VAL) {
    sequenceId = sequenceId + 1
  } else if (sequenceId === MAX_VAL) {
    sequenceId = 0
  }
  return sequenceId
}

function getConstraintValue (constraint) {
  const key = R.keys(constraint[0])[0]
  let value
  
  if(key === 'Value'){
    value = constraint[0][key]
    value = value.join(' ')
  }
  
  return value
}

/**
  * initiateCircularBuffer() inserts default value for each dataitem (from the schema)
  * in to the database which in turn updates circular buffer, hashCurrent and hashLast.
  *
  * @param = {object} dataitem: Array of all dataItem for each devices in  schema
  * @param = {String} time: time from deviceSchema
  * @param = {String} uuid: UUID from deviceSchema
  */

function initiateCircularBuffer (dataItems, uuid) {
  const time = moment().toISOString()
  const device = getDeviceName(uuid)
  let dupId = 0
  R.map((dataItem) => {
    const { name, id, type, statistic } = dataItem.$
    const { path, Constraints } = dataItem
    const obj = { sequenceId: getSequenceId(), id, uuid, time, path }

    if (name !== undefined) {
      obj.dataItemName = name
    }

    if(statistic){
      obj.statistic = statistic
    }

    if (Constraints !== undefined) {
      obj.value = getConstraintValue(Constraints)
      if(!obj.value){
        obj.value = 'UNAVAILABLE'
      }
    } else if (type === 'AVAILABILITY' && dataStorage.getConfiguredVal(device, 'AutoAvailable')) {
      log.debug('Setting all Availability dataItems to AVAILABLE')
      obj.value = 'AVAILABLE'
    } else {
      obj.value = 'UNAVAILABLE'
    }
    // check dupId only if duplicateCheck is required
    if (dataStorage.getConfiguredVal(device, 'FilterDuplicates')){ 
      dupId = checkDuplicateId(id)
    }

    if (!dupId) {
      insertRawData(obj)
      const obj2 = R.clone(obj)
      dataStorage.hashLast.set(id, obj2)
    } else {
      log.error(`Duplicate DataItem id ${id} for device ${device} and dataItem name ${name} `)
    }

    return 0
  }, dataItems)
}

/**
  * dataItemsParse() creates a dataItem array containing all dataItem from the schema
  *
  * @param {Object} container
  *
  */
function dataItemsParse (dataItems, path, uuid) {
  if(!dataStorage.hashDataItemsByName.has(uuid)){
    dataStorage.hashDataItemsByName.set(uuid, new Map())
  }

  if(!dataStorage.hashDataItemsBySource.has(uuid)){
    dataStorage.hashDataItemsBySource.set(uuid, new Map()) 
  }

  const mapByName = dataStorage.hashDataItemsByName.get(uuid)
  const mapBySource = dataStorage.hashDataItemsBySource.get(uuid)
  
  for (let i = 0; i < dataItems.length; i++) {
    const dataItem = dataItems[i].DataItem
    for (let j = 0; j < dataItem.length; j++) {
      if (dataItem[j] !== undefined) {
        const category = dataItem[j].$.category
        const name = dataItem[j].$.name
        let path3 = `${path}//DataItem`
        if (dataItem[j].$.type) {
          const typeVal = dataItem[j].$.type
          if (dataItem[j].$.subType) {
            const subTypeVal = dataItem[j].$.subType
            path3 = `${path3}[@category="${category}" and @type="${typeVal}" and @subType="${subTypeVal}"]`
          } else {
            path3 = `${path3}[@category="${category}" and @type="${typeVal}"]`
          }
        }
        
        if(name){
          path3 = path3.substr(0, path3.length - 1) + ` and @name="${name}"` + path3.substr(path3.length - 1)
        }
        
        const dataItemObj = R.clone(dataItem[j])
        dataItemObj.path = path3
        
        if(dataItem[j].Source){
          mapBySource.set(dataItem[j].Source[0], dataItemObj)
        }
        mapByName.set(name, dataItemObj)
      }
    }
  }

  dataStorage.hashDataItemsByName.set(uuid, mapByName)
  dataStorage.hashDataItemsBySource.set(uuid, mapBySource)
}

/* ******************** Device Schema Collection ****************** */

/**
  * searchDeviceSchema() searches the device schema collection
  * for the recent entry for the  given uuid
  *
  * @param {String} uuid
  *
  * returns the latest device schema entry for that uuid
  */
function searchDeviceSchema (uuid) {
  const deviceSchemaPtr = getSchemaDB()
  const latestSchema = deviceSchemaPtr.chain()
                                      .find({ uuid })
                                      .simplesort('time')
                                      .data()
  return latestSchema
}

function searchSchemaFor(name){
  const devices = getSchemaDB().data
  return function(value){
    return R.find(R.propEq(name, value), devices)
  }
}

/**
  * getDataItem() get all the dataItem(s) from the deviceSchema
  *
  * @param {String} uuid
  *
  * return {Array} dataItemsArr
  */
// function getDataItemByName (uuid, dataItemName) {
//   const map = dataStorage.hashDataItemsByName.get(uuid)
//   return map.get(dataItemName)
// }

// function getDataItemBySource (uuid, sourceName){
//   const map = dataStorage.hashDataItemsBySource.get(uuid)
//   return map.get(sourceName)
// }

function getDataItem(uuid, name){
  const mapByName = dataStorage.hashDataItemsByName.get(uuid)
  const mapBySource = dataStorage.hashDataItemsBySource.get(uuid)
  
  return mapByName.get(name) || mapBySource.get(name)
}

function getDataItems(uuid){
  const map = dataStorage.hashDataItemsByName.get(uuid)
  return Array.from(map.values())
}

function addEvents(device){
  const { DataItems } = device
  let path = `//Devices//Device[@name="${device.$.name}" and @uuid="${device.$.uuid}"]`

  const dataItems = DataItems[0].DataItem
  const availId = R.find(item => item.$.type === 'AVAILABILITY', dataItems)
  if(!availId){
    const obj = { $: { category: 'EVENT', name: 'avail', type: 'AVAILABILITY' }}
    dataItems.push(obj)
  }

  const assetChange = R.find(item => item.$.type === 'ASSET_CHANGED', dataItems)
  if(!assetChange){
    const obj = { $: { category: 'EVENT', name: 'assetChange', type: 'ASSET_CHANGED' }}
    dataItems.push(obj) 
  }

  const assetRemove = R.find(item => item.$.type === 'ASSET_REMOVED', dataItems)
  if(!assetRemove){
    const obj = { $: { category: 'EVENT', name: 'assetRemove', type: 'ASSET_REMOVED' }}
    dataItems.push(obj) 
  }

  updateDataItemsIds(DataItems, device.$.uuid, device.$.uuid, path)
}



function setDefaultConfigsForDevice(name){
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
  
  if(!dataStorage.hashAdapters.has(name)){
    dataStorage.hashAdapters.set(name, obj)
  }
}

/**
  * read objects from json and insert into collection
  * @param {Object} parsedData (JSONObj)
  *
  */
function insertSchemaToDB (jsonObj, sha) {
  const devices = jsonObj.MTConnectDevices.Devices[0].Device
  const timeVal = jsonObj.MTConnectDevices.Header[0].$.creationTime
  const xmlns = jsonObj.MTConnectDevices.$

  insertDevices(devices, timeVal, xmlns, sha)
}

function insertDevices(devices, timeVal, xmlns, sha){
  R.map((k) => {
    setDefaultConfigsForDevice(k.$.name)
    newDataItemsIds(k)
    mtcDevices.insert({
      xmlns,
      time: timeVal,
      name: k.$.name,
      uuid: k.$.uuid,
      device: k,
      sha
    })
    const dataItems = getDataItems(k.$.uuid)
    initiateCircularBuffer(dataItems, k.$.uuid)
  }, devices)
}

function goDeep(obj, device_uuid, component_uuid, path){
  let path1
  const props = R.keys(obj)
  R.map((prop) => {
    const component = obj[prop]
    R.map((k) => {
      let uuid
      path1 = `${path}//${prop}[@name="${k.$.name}"]`
      
      if(component_uuid){
        uuid = uuidv5(prop + k.$.name, component_uuid)
        k.$.id = genId(uuid)
      } else {
        uuid = uuidv5(prop + k.$.name, device_uuid)
        k.$.id = genId(uuid)
      }

      const keys = R.keys(k)

      R.map((key) => {
        if(key === 'Components'){
          const components = k[key]
          updateComponentsIds(components, device_uuid, uuid, path1)
        }

        if(key === 'References'){
          const references = k[key]
          updateReferencesIds(references, device_uuid)
        }

        if(key === 'DataItems'){
          const dataItems = k[key]
          updateDataItemsIds(dataItems, device_uuid, uuid, path1)
        }
      }, keys)
    }, component)
  }, props)
}

function updateReferencesIds(References, device_uuid){
  let id, dataItem
  R.map(({ Reference }) => {
    R.map((k) => {
      k.$.dataItemId = getDataItem(device_uuid, k.$.name).$.id
    }, Reference)
  }, References)
}


function updateDataItemsIds(DataItems, device_uuid, uuid, path){
  let dataItem_uuid, str
  R.map(({ DataItem }) => {
    R.map((k) => {

      if(!k.$.name){
        k.$.name = k.$.id
      }
      str = joinValuesByComma(k.$)
      dataItem_uuid = uuidv5(str, uuid)
      k.$.id = genId(dataItem_uuid)
    }, DataItem)
  }, DataItems)
  dataItemsParse(DataItems, path, device_uuid)
}

function updateComponentsIds(Components, device_uuid, component_uuid, path){
  R.map(Component => {
    goDeep(Component, device_uuid, component_uuid, path)
  }, Components)
}


function newDataItemsIds(device){
  const MTC_UUID = uuidv5('urn:mtconnect.org', '6ba7b812-9dad-11d1-80b4-00c04fd430c8')
  let path = `//Devices//Device[@name="${device.$.name}" and @uuid="${device.$.uuid}"]`
  
  if(!device.$.id){
    const device_nameSpace = uuidv5(device.$.uuid, MTC_UUID)
    device.$.id = genId(device_nameSpace)  
  }

  const { DataItems, Components, References } = device
  
  if(!DataItems){
    const DataItem = []
    device.DataItems = []
    device.DataItems.push({ DataItem }) 
  }
  
  addEvents(device)
  
  if(Components){
    updateComponentsIds(Components, device.$.uuid, undefined, path)
  }
  
  if(References){
    updateReferencesIds(References, device.$.uuid)
  } 
}

/**
  * compareSchema() checks for duplicate entry
  * @param {object} foundFromDc - existing device schema
  * entry in database with same uuid.
  * @param {object} newObj - received schema in JSON
  * returns true if the existing schema is same as the new schema
  */
function compareSchema (foundFromDc, newObj) {
  const dcHeader = foundFromDc[0].xmlns
  const dcTime = foundFromDc[0].time
  const dcDevice = foundFromDc[0].device
  const newHeader = newObj.MTConnectDevices.$
  const newTime = newObj.MTConnectDevices.Header[0].$.creationTime
  const newDevice = newObj.MTConnectDevices.Devices[0].Device[0]

  if (R.equals(dcHeader, newHeader)) {
    if (R.equals(dcTime, newTime)) {
      if (R.equals(dcDevice, newDevice)) {
        return true
      } return false
    } return false
  } return false
}

/**
  * updateSchemaCollection() updates the DB with newly received schema
  * after checking for duplicates
  * @param {object} schemaReceived - XML from http.get
  * returns the lokijs DB ptr
  */

function updateSchemaCollection (schema) { // TODO check duplicate first.
  const sha = sha1(schema)
  const jsonObj = xmlToJSON.xmlToJSON(schema)
  const searchSchemaForSha = searchSchemaFor('sha')
  const schemaFound = searchSchemaForSha(sha)
  const data = jsonObj.MTConnectDevices.Devices[0].Device[0].Description[0].Data
  let result

  if(schemaFound){
    log.debug('Schema already exist')
    addAvailabilityEvent(jsonObj)
  } else {
    insertSchemaToDB(jsonObj, sha)
  }
  
  if(data){
    result = data[0].$.href.split(':')
  }

  return result
}

function addAvailabilityEvent (jsonObj){ 
  const devices = jsonObj.MTConnectDevices.Devices[0].Device
  R.map((device) => {
    const autoAvailable = dataStorage.getConfiguredVal(device.$.name, 'AutoAvailable')
    if(autoAvailable){
      const id = getDataItem(device.$.uuid, 'avail').$.id
      const dataItem = dataStorage.hashCurrent.get(id)
      if(dataItem.value === 'UNAVAILABLE'){
        const uuid = dataItem.uuid
        const time = moment.utc().format()
        const dataItemName = dataItem.name
        const type = dataItem.type
        const path = dataItem.path
        const constraint = dataItem.Constraints
        const obj = { sequenceId: getSequenceId(), id, uuid, time, type, path }

        if (dataItemName !== undefined) {
          obj.dataItemName = dataItemName
        }
        
        obj.value = 'AVAILABLE'
        
        // updates cb and hC
        insertRawData(obj)
      }
    }
  }, devices)
}

// ******************** Raw Data Collection ******************* //

/**
  * post insert listener
  * calling function updateCircularBuffer on every insert to lokijs
  *
  *  @param obj = jsonData inserted in lokijs
  * { sequenceId: 0, id:'dtop_2', uuid:'000', time: '2',
  *    dataItemName:'avail', value: 'AVAILABLE' }
  */
rawData.on('insert', (obj) => {
  const id = obj.id
  const obj1 = R.clone(obj)
  const obj2 = R.clone(obj)
  dataStorage.updateCircularBuffer(obj1)
  dataStorage.hashCurrent.set(id, obj2) // updating hashCurrent
})

/* ****************************************Asset********************************* */

function updateAssetChg (assetId, assetType, uuid, time) {
  const device = getDeviceName(uuid)
  const latestSchema = (searchDeviceSchema(uuid))[0]
  const id = getDataItem(uuid, 'assetChange').$.id
  const dataItem = dataStorage.hashCurrent.get(id)
  if (dataItem === undefined) {
    return log.debug('ASSET_CHANGED Event not present')
  }
  if (dataItem.value === assetId) {  // duplicate check
    return log.debug('Duplicate Entry')
  }
  dataItem.sequenceId = getSequenceId()//sequenceId++
  dataItem.time = getTime(time, device)
  dataItem.value = assetId
  dataItem.assetType = assetType
  const dataItemClone = R.clone(dataItem)
  dataStorage.circularBuffer.push(dataItemClone)
  return dataItem // eslint
}

function updateAssetRem (assetId, assetType, uuid, time) {
  const device = getDeviceName(uuid)
  const latestSchema = (searchDeviceSchema(uuid))[0]
  const id = getDataItem(uuid, 'assetRemove').$.id
  const dataItem = dataStorage.hashCurrent.get(id)
  if (dataItem === undefined) {
    return log.debug('ASSET_REMOVED Event not present')
  }
  const assetChgId = getDataItem(uuid, 'assetChange').$.id
  const assetChg = dataStorage.hashCurrent.get(assetChgId)
  if (assetChg.value === assetId) {
    updateAssetChg('UNAVAILABLE', assetType, uuid, time)
  }
  if (dataItem.value === assetId) { // duplicate check
    return log.debug('Duplicate Entry')
  }
  dataItem.sequenceId = getSequenceId()//sequenceId++
  dataItem.time = getTime(time, device)
  dataItem.value = assetId
  dataItem.assetType = assetType
  const dataItemClone = R.clone(dataItem)
  dataStorage.circularBuffer.push(dataItemClone)
  return dataItem // eslint
}

function removeAsset (shdrarg, uuid) {
  const device = getDeviceName(uuid)
  const time = shdrarg.time
  const assetItem = shdrarg.dataitem[0]
  let assetId
  if(typeof(assetItem.value) === 'string'){
    assetId = assetItem.value
  } else {
    assetId = assetItem.value[0]
  }
  const assetPresent = dataStorage.hashAssetCurrent.get(assetId)
  const assetType = assetPresent.assetType
  if (assetPresent === undefined) {
    return log.debug('Error: Asset not Present')
  }

  const assetToRemove = R.clone(assetPresent)
  assetToRemove.removed = true
  assetToRemove.time = getTime(time, device)
  dataStorage.hashAssetCurrent.set(assetId, assetToRemove)
  updateAssetRem(assetId, assetType, uuid, time)
  return assetToRemove
}

function findKey (asset, object, key) {
  if (object.hasOwnProperty(key)) {
    return asset
  }
  const keys = Object.keys(object)
  for (let i = 0; i < keys.length; i++) {
    if (typeof object[keys[i]] === 'object') {
      const o = findKey(asset[keys[i]], object[Object.keys(object)[i]], key)
      if (o != null) {
        return o
      }
    }
  }
  return undefined
}

/**
  * assetToUpdate - cloned asset already present.
  * dataItemSet - data to be updated
  *
  *
  */
function updateAsset (assetToUpdate, dataItemSet) {
  let key
  let value
  let foundKey
  const dataItem = []
  if (dataItemSet.length === 1) { // xml format
    const jsonAsset = xmlToJSON.xmlToJSON(dataItemSet)
    key = (R.keys(jsonAsset))[0]
    value = R.pluck(key)([jsonAsset])[0]
    foundKey = findKey(assetToUpdate.value, assetToUpdate.value, key)
    foundKey[key][0] = value
  } else { // key value pair
    const totalDataItem = (dataItemSet.length) / 2
    for (let i = 0, j = 0; i < totalDataItem; i++, j += 2) {
      //  Eg: dataitem[i] = { name: (avail), value: (AVAILABLE) };
      let name = dataItemSet[j]
      let value = dataItemSet[j + 1]
      if (name === 'CutterStatus') {
        name = 'Status'
        if (value.includes(',')) { // Eg: 'USED,AVAILABLE'
          value = value.split(',')
        }
      }
      dataItem.push({ name, value })
    }
    R.map((k) => {
      key = k.name
      foundKey = findKey(assetToUpdate.value, assetToUpdate.value, key)
      if (foundKey.Status !== undefined) {
        // check status validity
        // const validValues = checkStatusValues(k.value);
        foundKey.Status = k.value
      } else {
        if(typeof(foundKey[k.name]) === 'string' && typeof(k.value) === 'object'){
          foundKey[k.name] = k.value[k.name]
        } else {
          foundKey[k.name][0]._ = k.value
        }
      }
      return foundKey // eslint
    }, dataItem)
  }
  return assetToUpdate
}

function updateAssetCollection(shdrarg, uuid) {
  const device = getDeviceName(uuid)
  const assetItem = shdrarg.dataitem[0]
  const { time } = shdrarg
  const assetId = assetItem.value[0]
  // Eg: Non xml assetDataItem : [ 'ToolLife', '120', 'CuttingDiameterMax', '40' ]
  /* Eg: xml assetDataItem :
   * [ '<OverallToolLength nominal="323.65" minimum="323.60" maximum="324.124" code="OAL">323.65</OverallToolLength>' ] */
  const assetDataItem = assetItem.value.slice(1, Infinity)
  const assetPresent = dataStorage.hashAssetCurrent.get(assetId)

  if (assetPresent === undefined) {
    return log.debug('Error: Asset not Present')
  }
  const assetType = assetPresent.assetType
  const assetToUpdate = R.clone(assetPresent)
  const newVal = updateAsset(assetToUpdate, assetDataItem)
  //console.log(newVal.value.CuttingTool.CuttingToolLifeCycle[0].CutterStatus)
  newVal.time = getTime(time, device)
  dataStorage.hashAssetCurrent.set(assetId, newVal)
  dataStorage.assetBuffer.push(newVal)
  updateAssetChg(assetId, assetType, uuid, time)
  return newVal
}

function updateAssetCollectionThruPUT (shdrarg, uuid) { // args: shdrarg, uuid
  const { removed } = handleAsset(shdrarg)
  let dataItem
  
  if(removed){
    dataItem = removeAsset(shdrarg, uuid)
  } else {
    dataItem = updateAssetCollection(shdrarg, uuid)
  }
  
  if(dataItem){
    return true
  }
  return false
}

function createAssetCollection (assetId) {
  let assetPresent = false
  if (assetCollection.length === 0) {
    assetCollection.push(assetId)
    return
  }
  R.find((k) => {
    if (k === assetId) {
      assetPresent = true
    }
    return assetPresent
  }, assetCollection)
  if (!assetPresent) {
    assetCollection.push(assetId)
  }
}

function handleAsset(shdrarg){
  const assetItem = shdrarg.dataitem[0]
  const { time } = shdrarg
  const [ assetId, assetType, assetValue ] = assetItem.value
  const value = assetValueToJSON(assetValue)
  
  let removed = false
  if(value && value.CuttingTool.$ && value.CuttingTool.$.removed){
    removed = true
  }
  return { time, assetId, assetType, assetValue, value, removed }
}

function buildAsset(uuid, time, assetId, assetType, removed, value){
  const device = getDeviceName(uuid)
  const obj = {
    time: getTime(time, device),
    assetId,
    uuid,
    target: device,
    assetType,
    removed,
    value
  }
  return obj
}

function assetValueToJSON(assetValue){
  let value
  if(typeof(assetValue) !== 'object'){
    if (assetValue && assetValue.includes('--multiline--')) {
      const start = assetValue.search('--multiline--')
      const end = assetValue.indexOf('\n', start)
      const tag = assetValue.slice(start, end)
      const stringEnd = assetValue.lastIndexOf(tag)
      const valueString = assetValue.slice(end, stringEnd)
      assetValue = valueString.replace(/(\r\n|\n|\r)/gm, '')
    }
    value = xmlToJSON.xmlToJSON(assetValue)
  } else {
    value = assetValue
  }
  return value
}

function addToAssetCollection (shdrarg, uuid) {
  const { time, assetId, assetType, assetValue, value, removed } = handleAsset(shdrarg)

  if (value === undefined) {
    console.log(`addToAssetCollection: Error parsing asset ${assetId}`)
    log.debug(`addToAssetCollection: Error parsing asset ${assetId}`)
    return false
  }
  
  if (assetId !== undefined && assetType !== undefined && assetValue !== undefined) {
    const asset = dataStorage.hashAssetCurrent.get(assetId)
    
    if(asset){
      log.debug('Error: Asset already Present')
      return false
    }

    const obj = buildAsset(uuid, time, assetId, assetType, removed, value)
    const obj1 = R.clone(obj)
    dataStorage.assetBuffer.push(obj)
    dataStorage.hashAssetCurrent.set(assetId, obj1)
    createAssetCollection(assetId)
    updateAssetChg(assetId, assetType, uuid, time)
    return true
  }
  log.debug(`Asset ${assetId} missing required type, id or body. Asset is rejected.`)
  return false
}

function getAssetCollection () {
  return assetCollection
}

function removeAllAssets (shdrarg, uuid) {
  const device = getDeviceName(uuid)
  const assets = getAssetCollection()
  const time = shdrarg.time
  const assetItem = shdrarg.dataitem[0]
  const assetType = assetItem.value[0]
  const hashAssetCurrent = dataStorage.hashAssetCurrent
  R.map((k) => {
    const assetData = hashAssetCurrent.get(k)
    if (assetData !== undefined) {
      if (assetData.assetType === assetType && assetData.removed !== true) {
        const assetToRemove = R.clone(assetData)
        assetToRemove.removed = true
        assetToRemove.time = getTime(time, device)
        dataStorage.hashAssetCurrent.set(k, assetToRemove)
        return updateAssetRem(k, assetType, uuid, time)
      }
    }
    return assetData // eslint
  }, assets)
}

function dealingWithAssets(dataItemName, shdrarg, uuid){
  if (dataItemName === '@ASSET@') {
    return addToAssetCollection(shdrarg, uuid)
  } else if (dataItemName === '@UPDATE_ASSET@') {
    return updateAssetCollection(shdrarg, uuid)
  } else if (dataItemName === '@REMOVE_ASSET@') {
    return removeAsset(shdrarg, uuid)
  } else if (dataItemName === '@REMOVE_ALL_ASSETS@') {
    return removeAllAssets(shdrarg, uuid)
  }
}

function dealingWithConstrains(dataItem, obj, data, conversionRequired, ConversionRequired, UpcaseDataItemValue){
  let rawValue
  if(dataItem.Constraints){
    R.map((constraint) => {
      const keys = R.keys(constraint)
      R.map((key) => {
        
        if(key === 'Value'){
          rawValue = constraint[key][0]
        }

        if(key === 'Filter'){
          const prevValue = dataStorage.hashCurrent.get(obj.id).value
          const valueFilter = dataItemjs.getFilterValue(dataItem.Constraints)
          rawValue = dataItemjs.filterValue(valueFilter, data.value, prevValue)
        }

      }, keys)
    }, dataItem.Constraints)
    
  } else {
    rawValue = data.value
  }
  
  if (UpcaseDataItemValue) {
    if (!Array.isArray(rawValue)) {
      rawValue = rawValue.toUpperCase()
    } else { // CONDITION
      rawValue[0] = rawValue[0].toUpperCase()
    }
  }

  if (ConversionRequired && conversionRequired) {
    obj.value = dataItemjs.convertValue(rawValue, dataItem)
  } else {
    obj.value = rawValue
  }
}

function dealingWithRest(dataItem, obj, data){
  if(dataItem.$.statistic){
    obj.statistic = dataItem.$.statistic
  }
  
  if(dataItem.$.representation){
    obj.representation = dataItem.$.representation
  }

  obj.category = dataItem.$.category

  if(data.value.includes(':')){
    const [ initialValue, resetTriggered ] = data.value.split(':')
    obj.resetTriggered = resetTriggered
    obj.value = initialValue
  }
}

function dealingWithTimeSeries(obj, dataItem, device, data){
  const UpcaseDataItemValue = dataStorage.getConfiguredVal(device, 'UpcaseDataItemValue')
  const ConversionRequired = dataStorage.getConfiguredVal(device, 'ConversionRequired')
  const conversionRequired = dataItemjs.conversionRequired(dataItem)
  // let rawValue
  
  if (data.isTimeSeries) {
    let sampleCount
    let sampleRate
    if (data.value[0] === '') {
      sampleCount = 0
    } else {
      sampleCount = data.value[0]
    }
    if (data.value[1] === '') {
      sampleRate = 0
    } else {
      sampleRate = data.value[1]
    }
    const value = data.value.slice(2, Infinity)
    obj.sampleRate = sampleRate
    obj.sampleCount = sampleCount
    if (ConversionRequired && conversionRequired) {
      obj.value = [dataItemjs.convertTimeSeriesValue(value[0], dataItem)]
    } else {
      obj.value = value
    }
  } else { // allOthers
    dealingWithConstrains(dataItem, obj, data, conversionRequired, ConversionRequired, UpcaseDataItemValue)
  }

  dealingWithRest(dataItem, obj, data)
  return obj
}

function dealingWithDataItems(shdrarg, uuid, data, dataItemName, device){
  const dataItem = getDataItem(uuid, dataItemName)
  const { time } = shdrarg
  let dataDuration, dataTime

  if(!dataItem) return undefined
  
  if(time){
    [ dataTime, dataDuration ] = time.split('@')
  }
  
  const obj = { 
    sequenceId: undefined,
    uuid,
    time: getTime(dataTime, device),
    path: dataItem.path,
    dataItemName
  }
 
  let id = dataItem.$.id

  if(dataDuration){
    obj.duration = dataDuration
  }

  if(id){
    obj.id = id 
    return dealingWithTimeSeries(obj, dataItem, device, data)
  }
  return undefined
}

//  TODO: include toUpperCase() depending on config param
//  TODO: change initiateCB on updateSchemaCollection, only the new values should be added with UNAVAILABLE.
/**
  * dataCollectionUpdate() inserts the shdr data into the shdr collection
  *
  * @param {Object} shdrarg - with dataitem and time
  *
  */
function dataCollectionUpdate (shdrarg, uuid) {
  const dataitemno = shdrarg.dataitem.length
  const device = getDeviceName(uuid)
  const FilterDuplicates = dataStorage.getConfiguredVal(device, 'FilterDuplicates')
  let dataItemName
  let dataItem
  let obj
  for (let i = 0; i < dataitemno; i++) {
    dataItemName = shdrarg.dataitem[i].name
    data = shdrarg.dataitem[i]
    
    // ASSSETS
    if(dataItemName.includes('ASSET')){
      dealingWithAssets(dataItemName, shdrarg, uuid)
    } else {
      // DATAITEMS
      obj = dealingWithDataItems(shdrarg, uuid, data, dataItemName, device)
      if(!obj){
        log.debug(`Bad DataItem ${dataItemName}`)
        continue
      }

      if (!dataStorage.hashCurrent.has(obj.id)) { // TODO: change duplicate Id check
        log.debug(`Could not find dataItem ${obj.id}`)
      } else {
        if (FilterDuplicates || obj.representation !== 'DISCRETE') {
          const dataItem = dataStorage.hashCurrent.get(obj.id)  
          const previousValue = dataItem.value
          
          if(R.equals(previousValue, obj.value)){
            log.debug('Duplicate entry')
            continue
          }

          // if (Array.isArray(previousValue) && (previousValue[0] === 'NORMAL') && (previousValue[0] === obj.value[0])) {
          //   log.debug('duplicate NORMAL Condition')
          //   continue
          // } else if ((previousValue === obj.value) && !Array.isArray(previousValue)) {
          //   log.debug('Duplicate entry') // eslint
          //   continue
          // }
        }
        
        if(obj.representation){
          delete obj.representation
        }

        if(obj.category === 'CONDITION'){
          dataStorage.addToHashCondition(obj)
        }

        obj.sequenceId = getSequenceId() // sequenceId++;
        insertRawData(obj)
      }
    }
  }
  return log.debug('updatedDataCollection')  // eslint
}

// To initiate the CB, hashCurrent and hashLast on disconnect
function updateBufferOnDisconnect (uuid) {
  const uuids = uuid.split('_')
  R.map((uuid) => {
    const dataItems = getDataItems(uuid)
    const time = moment.utc().format()
    const hC = dataStorage.hashCurrent
    R.map((dataItem) => {
      const id = dataItem.$.id
      const hCData = hC.get(id)
      if (hCData.value !== 'UNAVAILABLE') {
        const { name, type } = dataItem.$
        const { path, Constraints } = dataItem
        const obj = { sequenceId: getSequenceId(), id, uuid, time, type, path }

        if (name !== undefined) {
          obj.dataItemName = name
        }
        
        if (Constraints !== undefined) {
          obj.value = getConstraintValue(Constraints)
          if(!obj.value){
            obj.value = 'UNAVAILABLE'
          }
        } else {
          obj.value = 'UNAVAILABLE'
        }
        // updates cb and hC
        insertRawData(obj)
      }
      return id // eslint
    }, dataItems)  
  }, uuids)
}

/**
  * probeResponse() create json as a response to probe request
  *
  * @param {Object} latestSchema - latest device schema
  *
  * returns the JSON object with device detail.
  */

function probeResponse (latestSchema) {
  const newXMLns = latestSchema[0].xmlns
  const newTime = moment.utc().format()
  const dvcHeader = latestSchema[0].device.$
  const dvcDescription = latestSchema[0].device.Description
  const dataItems = latestSchema[0].device.DataItems
  const components = latestSchema[0].device.Components
  const instanceId = 0
  const assets = dataStorage.assetBuffer.toArray()
  let dataItem // TODO Update the value

  let newJSON = {}
  const Device = [{ $:
    { name: dvcHeader.name, uuid: dvcHeader.uuid },
    Description: dvcDescription
  }]

  if (dataItems !== undefined) {
    for (let j = 0; j < dataItems.length; j++) {
      dataItem = dataItems[j].DataItem
    }
    Device[0].DataItems = [{ dataItem }]
  }

  if (components !== undefined) {
    Device[0].Components = components
  }

  newJSON = { MTConnectDevices: { $: newXMLns,
    Header: [{ $:
    { creationTime: newTime,
      assetBufferSize: dataStorage.assetBuffer.size,
      sender: 'localhost',
      //assetCount: dataStorage.assetBuffer.length,
      version: '1.3',
      instanceId,
      bufferSize: dataStorage.bufferSize }, AssetCounts:[] }],
    Devices: [{ Device }] } }
  
  const types = {}
  let assetType
  R.map((asset) => {
    assetType = asset.assetType
    if(types[assetType]){
      types[assetType] += 1
    } else {
      types[assetType] = 1
    }
  }, assets)

  const keys = R.keys(types)
  let AssetCount
  R.map((key) => {
    AssetCount = {
      $: {
        assetType: key
      },
      _: types[key]
    }
    newJSON.MTConnectDevices.Header[0].AssetCounts.push({ AssetCount })
  }, keys)
  return newJSON
}

/**
  * getPathArr creates an array of path parameter for given device collection
  * @param {String} uuidCollection : array of uuid of active devices.
  * returns pathArr: array of path
  */
function getPathArr (uuidCollection) {
  const pathArr = []
  let i = 0
  R.map((uuid) => {
    const dataItemsSet = getDataItems(uuid)

    // create pathArr for all dataItems
    if (dataItemsSet.length !== 0) {
      for (let j = 0; j < dataItemsSet.length; j++) {
        pathArr[i++] = dataItemsSet[j].path
      }
    }
    return pathArr // eslint
  }, uuidCollection)
  return pathArr
}

function addNewUuidToPath(uuid){
  const dataItems = getDataItem(uuid)
  let item
  R.map((dataItem) => {
    item = dataStorage.hashCurrent.get(dataItem.$.id)
    item.uuid = uuid
    item.path = dataItem.path
    const obj1 = R.clone(item)
    const obj2 = R.clone(item)
    dataStorage.updateCircularBuffer(obj1)
    dataStorage.hashCurrent.set(dataItem.$.id, obj2)
  }, dataItems)
}

/**
  * pathValidation() checks whether the received path is a valid XPATH
  * @param recPath - eg: //Axes//Rotary
  * @param uuidCollection - array of uuid of active devices.
  * return true - if path Valid, false - invalid path.
  */
function pathValidation (recPath, uuidCollection) {
  const paths = dataStorage.dividingPaths(recPath)
  const pathArr = getPathArr(uuidCollection)
  let result
  if(Array.isArray(paths)){
    for(let i = 0, len = paths.length; i < len; i++){
      result = dataStorage.filterPathArr(pathArr, paths[i])
      if(result.length !== 0){
        return true
      }
    }
    return false  
  } else {
    result = dataStorage.filterPathArr(pathArr, recPath)
    if (result.length !== 0) {
      return true
    }
    return false
  }
}
// Exports

module.exports = {
  addToAssetCollection,
  compareSchema,
  dataCollectionUpdate,
  getDataItem,
  getDataItems,
  getRawDataDB,
  getSchemaDB,
  searchSchemaFor,
  getTime,
  getDeviceName,
  getAssetCollection,
  insertSchemaToDB,
  probeResponse,
  pathValidation,
  searchDeviceSchema,
  setDefaultConfigsForDevice, 
  initiateCircularBuffer,
  updateSchemaCollection,
  updateAssetCollectionThruPUT,
  updateBufferOnDisconnect,
  insertRawData,
  addNewUuidToPath
}
