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

// Imports - Internal

const config = require('./config/config')
const dataStorage = require('./dataStorage')
const xmlToJSON = require('./xmlToJSON')
const dataItemjs = require('./dataItem.js')

const log = require('./config/logger')

// Instances

const Db = new Loki('loki.json')

// Constants - datacollection pointers

const rawData = Db.addCollection('rawData')
const mtcDevices = Db.addCollection('DeviceDefinition')
const assetCollection = []

// const mRealTime = config.getConfiguredVal('mRealTime');
// const FilterDuplicates = config.getConfiguredVal('FilterDuplicates');
// const AutoAvailable = config.getConfiguredVal('AutoAvailable');

// variables
let mBaseTime = 0
let mBaseOffset = 0
let sequenceId = 1 // sequenceId starts from 1.
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

function getTime (adTime, device) {
  const IgnoreTimestamps = config.getConfiguredVal(device, 'IgnoreTimestamps')
  const RelativeTime = config.getConfiguredVal(device, 'RelativeTime')
  let result, offset
  let mParseTime = true
  if (RelativeTime) {
    if (mBaseTime === 0) {
      mBaseTime = moment().valueOf()
      if (adTime.includes('T')) {
        mParseTime = true
        mBaseOffset = moment(adTime).valueOf() // unix value of received time
      } else {
        mBaseOffset = Number(adTime)
      }
      offset = 0
    } else if (mParseTime) {
      offset = moment(adTime).valueOf() - mBaseOffset
    } else {
      offset = Number(adTime) - mBaseOffset
    }
    result = mBaseTime + offset // unix time_utc
    result = moment(result).toISOString()
  } else if (IgnoreTimestamps || (adTime === '')) { // current time
    result = moment().toISOString()
  } else { // time from adapter
    result = adTime
  }
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

/**
  * initiateCircularBuffer() inserts default value for each dataitem (from the schema)
  * in to the database which in turn updates circular buffer, hashCurrent and hashLast.
  *
  * @param = {object} dataitem: Array of all dataItem for each devices in  schema
  * @param = {String} time: time from deviceSchema
  * @param = {String} uuid: UUID from deviceSchema
  */

function initiateCircularBuffer (dataItem, timeVal, uuid) {
  const time = moment().toISOString()
  const device = getDeviceName(uuid)
  let dupCheck = 0
  let dupId = 0
  R.map((k) => {
    const dataItemName = k.$.name
    const id = k.$.id
    const type = k.$.type
    const path = k.path
    const constraint = k.Constraints
    const seqVal = getSequenceId()
    const obj = { sequenceId: seqVal, id, uuid, time, path }

    if (dataItemName !== undefined) {
      obj.dataItemName = dataItemName
    }
    if (constraint !== undefined) {
      obj.value = constraint[0].Value[0]
    } else if (type === 'AVAILABILITY' && config.getConfiguredVal(device, 'AutoAvailable')) {
      log.debug('Setting all Availability dataItems to AVAILABLE')
      obj.value = 'AVAILABLE'
    } else {
      obj.value = 'UNAVAILABLE'
    }
    // check dupId only if duplicateCheck is required
    if (config.getConfiguredVal(device, 'FilterDuplicates')) {
      dupId = checkDuplicateId(id)
    }

    if (!dupId) {
      insertRawData(obj)
      const obj1 = R.clone(obj)
      const obj2 = R.clone(obj)
      dataStorage.hashLast.set(id, obj2)
    } else {
      log.error(`Duplicate DataItem id ${id} for device ${getDeviceName(uuid)} and dataItem name ${dataItemName} `)
      dupCheck = 1
    }
    return 0 // to make eslint happy
  }, dataItem)
  return dupCheck
}

/**
  * dataItemsParse() creates a dataItem array containing all dataItem from the schema
  *
  * @param {Object} container
  *
  */
function dataItemsParse (dataItems, path) {
  for (let i = 0; i < dataItems.length; i++) {
    const dataItem = dataItems[i].DataItem
    for (let j = 0; j < dataItem.length; j++) {
      if (dataItem[j] !== undefined) {
        let path3 = `${path}//DataItem`
        if (dataItem[j].$.type) {
          const typeVal = dataItem[j].$.type
          if (dataItem[j].$.subType) {
            const subTypeVal = dataItem[j].$.subType
            path3 = `${path3}[@type="${typeVal}" and @subType="${subTypeVal}"]`
          } else {
            path3 = `${path3}[@type="${typeVal}"]`
          }
        }
        const dataItemObj = R.clone(dataItem[j])
        dataItemObj.path = path3
        dataItemsArr[d++] = dataItemObj
      }
    }
  }
}

/**
  * levelSixParse() separates DataItems in level six and passes them to dataItemsParse
  *
  *
  * @param {Object} container
  *
  */
function levelSixParse (container, path) {
  for (let i = 0; i < container.length; i++) {
    const keys = R.keys(container[i])
    // k = element of array keys
    R.find((k) => {
    // pluck the properties of all objects corresponding to k
      if ((R.pluck(k)([container[i]])) !== undefined) {
        const pluckedData = (R.pluck(k)([container[i]]))[0] // result will be an array

        for (let j = 0; j < pluckedData.length; j++) {
          const path1 = `${path}//${k}`
          const dataItems = pluckedData[j].DataItems
          dataItemsParse(dataItems, path1)
        }
      }
      return 0 // to make eslint happy
    }, keys)
  }
}

/**
  * levelFiveParse() separates Components and DataItems in level five
  * and call parsing in next level.
  *
  * @param {Object} container
  *
  */
function levelFiveParse (container, path) {
  for (let i = 0; i < container.length; i++) {
    if (container[i].Components !== undefined) {
      levelSixParse(container[i].Components, path)
    }
    if (container[i].DataItems !== undefined) {
      dataItemsParse(container[i].DataItems, path)
    }
  }
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

/**
  * getDataItem() get all the dataItem(s) from the deviceSchema
  *
  * @param {String} uuid
  *
  * return {Array} dataItemsArr
  */
function getDataItem (uuid) {
  dataItemsArr = []
  let path = ''
  d = 0
  const findUuid = searchDeviceSchema(uuid)
  if (findUuid.length === 0) {
    return null
  }

  const device = findUuid[findUuid.length - 1].device
  const deviceName = device.$.name
  if (!R.isEmpty(device)) {
    path = `//Devices//Device[@name="${deviceName}"]`
  }
  const dataItems = device.DataItems
  const components = device.Components
  if (dataItems !== undefined) {
    dataItemsParse(dataItems, path)
  }
  if (components !== undefined) {
    
    for (let i = 0; i < components.length; i++) {
       if (components[i].Axes !== undefined) {
         const path1 = `${path}//Axes`
         levelFiveParse(components[i].Axes, path1)
       }
       if (components[i].Controller !== undefined) {
         const path2 = `${path}//Controller`
         levelFiveParse(components[i].Controller, path2)
       }
       if (components[i].Systems !== undefined) {
         const path3 = `${path}//Systems`
         levelFiveParse(components[i].Systems, path3)
       }
     }
  }
  return dataItemsArr
}

function getDeviceId(uuid){
  const latestSchema = searchDeviceSchema(uuid)
  const device = latestSchema[latestSchema.length - 1].device
  return device.$.id
}

// function parseComponents(components, path){
//   let resPath
//   R.map((component) => {
//     if(component.Axes) resPath = `${path}//Axes`
//     if(component.Controller) resPath = `${path}//Controller`
//     if(component.Systems) resPath = `${path}//Systems`
//     levelFiveParse(component, resPath)
//     return resPath
//   }, components)
// }

// function parseComponent(component, path){

// }

function getDataItemForId (id, uuid) {
  const dataItemsArr = getDataItem(uuid)
  let dataItem = null
  R.find((k) => {
    if (k.$.id === id) {
      dataItem = k
    }
  }, dataItemsArr)
  return dataItem
}

function addEvents (uuid, availId, assetChangedId, assetRemovedId) {
  const findUuid = searchDeviceSchema(uuid)
  const device = findUuid[findUuid.length - 1].device
  const deviceId = device.$.id
  const dataItems = device.DataItems
  const dataItem = dataItems[dataItems.length - 1].DataItem
  
  if (!availId) { // Availability event is not present for the device
    const obj = { $: { category: 'EVENT', id: `${deviceId}_avail`, type: 'AVAILABILITY' } }
    dataItem.push(obj)
    config.setConfiguration(device, 'AutoAvailable', true)
  }

  if (!assetChangedId) {
    const obj = { $: { category: 'EVENT', id: `${deviceId}_asset_chg`, type: 'ASSET_CHANGED' } }
    dataItem.push(obj)
  }

  if (!assetRemovedId) {
    const obj = { $: { category: 'EVENT', id: `${deviceId}_asset_rem`, type: 'ASSET_REMOVED' } }
    dataItem.push(obj)
  }
}

// TODO: call function to check AVAILABILITY,
// if present change all AVAILABILITY event value to AVAILABLE.
// Check AVAILABILTY, ASSET_CHANGED, ASSET_REMOVED events
function checkForEvents (uuid) {
  const dataItemSet = getDataItem(uuid)
  let assetChangedId
  let assetRemovedId
  let availId
  if (!R.isEmpty(dataItemSet) || (dataItemSet !== null)) {
    R.map((k) => {
      const type = k.$.type
      if (type === 'AVAILABILITY') {
        availId = k.$.id
      } else if (type === 'ASSET_CHANGED') {
        assetChangedId = k.$.id
      } else if (type === 'ASSET_REMOVED') {
        assetRemovedId = k.$.id
      }
      return type // eslint
    }, dataItemSet)

    addEvents(uuid, availId, assetChangedId, assetRemovedId)
  }
}

/**
  * read objects from json and insert into collection
  * @param {Object} parsedData (JSONObj)
  *
  */
function insertSchemaToDB (parsedData, sha) {
  const parsedDevice = parsedData.MTConnectDevices
  const dupCheck = insertDevices(parsedDevice, sha)
  return dupCheck
}

function insertDevices(parsedDevice, sha){
  let dupCheck
  const timeVal = parsedDevice.Header[0].$.creationTime
  const xmlns = parsedDevice.$
  R.map((device) => {
    dubCheck = insertDevice(device.Device, timeVal, xmlns, sha)
    return dupCheck
  }, parsedDevice.Devices)
  return dubCheck
}

function insertDevice(device, timeVal, xmlns, sha){
  let dupCheck
  R.map((k) => {
    newDataItemsIds(k)
    mtcDevices.insert({
      xmlns,
      time: timeVal,
      name: k.$.name,
      uuid: k.$.uuid,
      device: k,
      sha
    })
    checkForEvents(k.$.uuid)
    const dataItemArray = getDataItem(k.$.uuid)
    dupCheck = initiateCircularBuffer(dataItemArray, timeVal, k.$.uuid)
    return dupCheck
  }, device)
  return dupCheck
}

function goDeep(obj, deviceId){
  const keys = R.keys(obj)
  R.map((key) => {
    const component = obj[key]
    R.map((k) => {
      const keys = R.keys(k)
      R.map((key) =>{
        if(key === 'Components'){
          const components = k[key]
          updateComponentsIds(components, deviceId)
        }

        if(key === 'DataItems'){
          const dataItems = k[key]
          updateDataItemsIds(dataItems, deviceId)
        }
      }, keys)
    }, component)
  }, keys)
}

function updateDataItemsIds(DataItems, deviceId){
  R.map(({ DataItem }) => {
    R.map(k => k.$.id = `${deviceId}_${k.$.id}`, DataItem)
  }, DataItems)
}

function updateComponentsIds(Components, deviceId){
  R.map(Component => goDeep(Component, deviceId), Components)
}


function newDataItemsIds(device){
  const deviceId = device.$.id
  const { DataItems, Components } = device
  updateDataItemsIds(DataItems, deviceId)
  if(Components){
    updateComponentsIds(Components, deviceId)
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
function updateSchemaCollection (schemaReceived) { // TODO check duplicate first.
  const xmlSha = sha1(schemaReceived)
  const jsonObj = xmlToJSON.xmlToJSON(schemaReceived)
  let dupCheck = 0
  if (jsonObj !== undefined) {
    const uuid = findUuid(jsonObj)
    dupCheck = checkIfUuidExist(uuid, jsonObj, xmlSha)
  } else {
    log.debug('xml parsing failed')
  }
  return dupCheck
}

function findUuid(jsonObj){
  const uuid = jsonObj.MTConnectDevices.Devices[0].Device[0].$.uuid
  const xmlSchema = getSchemaDB()
  const checkUuid = xmlSchema.chain()
                              .find({ uuid })
                              .data()
  return checkUuid
}

function checkIfUuidExist(uuid, jsonObj, sha){
  let dupCheck
  if (!uuid.length) {
    log.debug('Adding a new device schema')
    dupCheck = insertSchemaToDB(jsonObj, sha)
  } else if (sha === uuid[0].sha) {
    log.debug('This device schema already exist')
  } else {
    log.debug('Adding updated device schema')
    dupCheck = insertSchemaToDB(jsonObj, sha)
  }
  return dubCheck
}

// ******************** Raw Data Collection ******************* //

function getPath (uuid, dataItemName) {
  const dataItemArray = getDataItem(uuid)
  const deviceId = getDeviceId(uuid)
  let path
  if (dataItemArray !== null) {
    R.find((k) => {
      if ((k.$.name === dataItemName) || (k.$.id === `${deviceId}_${dataItemName}`)) {
        path = k.path
      }
      return path // eslint
    }, dataItemArray)
  }
  return path
}

/**
  * getId() get the Id for the dataitem from the deviceSchema
  *
  * @param {String} uuid
  * @param {String} dataItemName
  *
  * return id (Eg:'dtop_2')
  */
function getId (uuid, dataItemName) {
  let id
  const dataItemArray = getDataItem(uuid)
  const deviceId = getDeviceId(uuid)
  if (dataItemArray !== null) {
    R.find((k) => {
      if (k.$.name === dataItemName) {
        id = k.$.id
      }
      return (id !== undefined)
    }, dataItemArray)
  } else {
    log.debug('error in getId')
  }
  return id
}

/**
  * searchId() get the Id for the dataitem from the deviceSchema
  *
  * @param {String} uuid
  * @param {String} dataItemName
  *
  * return id (Eg:'dtop_2')
  */
function searchId (uuid, dataItemName) {
  let id
  const dataItemArray = getDataItem(uuid)
  const deviceId = getDeviceId(uuid)
  if (dataItemArray !== null) {
    R.find((k) => {
      if (k.$.id === `${deviceId}_${dataItemName}`) {
        id = k.$.id
      }
      return (id !== undefined)
    }, dataItemArray)
  } else {
    log.debug('Error in searchId')
  }
  return id
}

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
  const deviceId = latestSchema.device.$.id
  const id = `${deviceId}_asset_chg`
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
  const deviceId = latestSchema.device.$.id
  const id = `${deviceId}_asset_rem`
  const dataItem = dataStorage.hashCurrent.get(id)
  if (dataItem === undefined) {
    return log.debug('ASSET_REMOVED Event not present')
  }
  const assetChgId = `${deviceId}_asset_chg`
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
  // const { time, assetId, assetType, assetValue, value, removed } = handleAsset(shdrarg)
  // let equal = false
  // // Eg: Non xml assetDataItem : [ 'ToolLife', '120', 'CuttingDiameterMax', '40' ]
  // /* Eg: xml assetDataItem :
  //  * [ '<OverallToolLength nominal="323.65" minimum="323.60" maximum="324.124" code="OAL">323.65</OverallToolLength>' ] */
  // if (assetId === undefined && assetType === undefined && assetValue === undefined){
  //   log.debug(`Asset ${assetId} missing required type, id or body. Asset is rejected.`)
  //   return false
  // }

  // if (value === undefined) {
  //   console.log(`updateAssetCollection: Error parsing asset ${assetId}`)
  //   log.debug(`updateAssetCollection: Error parsing asset ${assetId}`)
  //   return false
  // }

  // const assetPresent = dataStorage.hashAssetCurrent.get(assetId)

  // if (assetPresent === undefined) {
  //   log.debug('Error: Asset not Present')
  //   return false
  // }

  // const prep = R.whereEq(assetPresent)
  // const updatedAsset = buildAsset(uuid, time, assetId, assetType, removed, value)
  
  // //check if updated asset is not equal to asset that in hashAssetCurrent
  // equal = prep(updateAsset)
  
  // if(equal){
  //   log.debug('Asset dublicate')
  //   return false
  // }
  
  // //check if removed is true
  // if(removed){
  //   const assets = dataStorage.assetBuffer.toArray()
  //   const index = R.findIndex(asset => asset.assetId === assetId)(assets)
  //   if(index > -1){
  //     dataStorage.assetBuffer.set(index, updatedAsset)
  //   } else {
  //     dataStorage.assetBuffer.push(updatedAsset)
  //   } 
  //   updateAssetRem(assetId, assetType, uuid, time)
  // } else {
  //   dataStorage.assetBuffer.push(updatedAsset)
  //   updateAssetChg(assetId, assetType, uuid, time)
  // }

  // dataStorage.hashAssetCurrent.set(assetId, updatedAsset)
  // return true
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
  const ConversionRequired = config.getConfiguredVal(device, 'ConversionRequired')
  const UpcaseDataItemValue = config.getConfiguredVal(device, 'UpcaseDataItemValue')
  const FilterDuplicates = config.getConfiguredVal(device, 'FilterDuplicates')
  let rawValue
  for (let i = 0; i < dataitemno; i++) {
    const dataItemName = shdrarg.dataitem[i].name
    // ASSSETS
    if (dataItemName === '@ASSET@') {
      return addToAssetCollection(shdrarg, uuid)
    } else if (dataItemName === '@UPDATE_ASSET@') {
      return updateAssetCollection(shdrarg, uuid)
    } else if (dataItemName === '@REMOVE_ASSET@') {
      return removeAsset(shdrarg, uuid)
    } else if (dataItemName === '@REMOVE_ALL_ASSETS@') {
      return removeAllAssets(shdrarg, uuid)
    }
    // DATAITEMS
    const obj = { sequenceId: undefined,
      uuid}

    obj.time = getTime(shdrarg.time, device)
    let id = getId(uuid, dataItemName)
    if (id !== undefined) {
      obj.dataItemName = dataItemName
    } else {
      id = searchId(uuid, dataItemName)
    }
    obj.id = id
    const path = getPath(uuid, dataItemName)
    obj.path = path
    const dataItem = getDataItemForId(id, uuid)
    const conversionRequired = dataItemjs.conversionRequired(id, dataItem)
    // TimeSeries
    if (shdrarg.dataitem[i].isTimeSeries) {
      let sampleCount
      let sampleRate
      const data = shdrarg.dataitem[i]
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
      rawValue = shdrarg.dataitem[i].value
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

    if (!dataStorage.hashCurrent.has(id)) { // TODO: change duplicate Id check
      log.debug(`Could not find dataItem ${id}`)
    } else {
      if (FilterDuplicates) {
        const dataItem = dataStorage.hashCurrent.get(id)  
        const previousValue = dataItem.value
        if (Array.isArray(previousValue) && (previousValue[0] === 'NORMAL') && (previousValue[0] === obj.value[0])) {
          return log.debug('duplicate NORMAL Condition')
        } else if ((previousValue === obj.value) && !Array.isArray(previousValue)) {
          return log.debug('Duplicate entry') // eslint
        }
      }
      obj.sequenceId = getSequenceId() // sequenceId++;
      insertRawData(obj)
    }
  }
  return log.debug('updatedDataCollection')  // eslint
}

// To initiate the CB, hashCurrent and hashLast on disconnect
function updateBufferOnDisconnect (uuid) {
  const dataItem = getDataItem(uuid)
  const time = moment.utc().format()
  const hC = dataStorage.hashCurrent
  R.map((k) => {
    const id = k.$.id
    const hCData = hC.get(id)
    if (hCData.value !== 'UNAVAILABLE') {
      const dataItemName = k.$.name
      const type = k.$.type
      const path = k.path
      const constraint = k.Constraints
      const obj = { sequenceId: getSequenceId(), id, uuid, time, type, path }

      if (dataItemName !== undefined) {
        obj.dataItemName = dataItemName
      }
      if (constraint !== undefined) {
        obj.value = constraint[0].Value[0]
      } else {
        obj.value = 'UNAVAILABLE'
      }
      // updates cb and hC
      insertRawData(obj)
    }
    return id // eslint
  }, dataItem)
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
      assetCount: dataStorage.assetBuffer.length,
      version: '1.3',
      instanceId,
      bufferSize: dataStorage.bufferSize } }],
    Devices: [{ Device }] } }

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
  R.map((k) => {
    const dataItemsSet = getDataItem(k)

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

/**
  * pathValidation() checks whether the received path is a valid XPATH
  * @param recPath - eg: //Axes//Rotary
  * @param uuidCollection - array of uuid of active devices.
  * return true - if path Valid, false - invalid path.
  */
function pathValidation (recPath, uuidCollection) {
  const pathArr = getPathArr(uuidCollection)
  const result = dataStorage.filterPathArr(pathArr, recPath)
  if (result.length !== 0) {
    return true
  }
  return false
}
// Exports

module.exports = {
  addToAssetCollection,
  compareSchema,
  checkForEvents,
  dataCollectionUpdate,
  getDataItem,
  getDataItemForId,
  getRawDataDB,
  getSchemaDB,
  getDeviceId,
  getId,
  getPath,
  getTime,
  getDeviceName,
  getAssetCollection,
  insertSchemaToDB,
  probeResponse,
  pathValidation,
  searchDeviceSchema,
  initiateCircularBuffer,
  updateSchemaCollection,
  updateAssetCollectionThruPUT,
  updateBufferOnDisconnect,
  insertRawData
}
