const R = require('ramda')
const moment = require('moment')
const { errResponse, assetImplementation } = require('../utils/handlers')
const common = require('../common')
const lokijs = require('../lokijs')
// TODO handle routes here including id parsing

function * getAsset () {
  let idsA
  const { ids, device } = this.params
  if (ids) {
    idsA = ids.split(';')
  }
  const { type, count, removed, target, archetypeId } = this.query
  assetImplementation(this, idsA, type, Number(count), removed, (target || device), archetypeId, this.request.type)
}

function * createAsset () {
  const { id } = this.params
  const { device, type } = this.query
  const { body } = this.request
  const uuidCollection = common.getAllDeviceUuids(this.mtc.devices)
  const name = 'addAsset'
  let uuid = common.getDeviceUuid(device)

  if ((uuid === undefined) && !R.isEmpty(uuidCollection)) {
    uuid = uuidCollection[0] // default device
  } else if (R.isEmpty(uuidCollection)) {
    return errResponse(this, this.request.type, 'NO_DEVICE', device)
  }

  //console.log(jsonData.dataitem[0].value, uuid)
  const jsonData = jsonDataItem(id, type, body, name)
  const status = lokijs.addToAssetCollection(jsonData, uuid)

  if (status) {
    this.body = '<success/>\r\n'
    return true
  }
  this.body = '<failed/>\r\n'
  return false
}

function setTimeAndValue(jsonData, body, value){
  const keys = R.keys(body)
  R.forEach((k) => {
    let time
    if (k === 'time') {
    time = R.pluck(k, [body])
      jsonData.time = time[0]
    }
    //R.isEmpty(time) returns false
    if (!R.isEmpty(time)) {
      jsonData.time = moment.utc().format()
    }
    if (k === 'body') {
      const data = R.pluck(k, [body])
      value.push(data[0])
    } else {
      value.push(body)
    }
  }, keys)
}

function jsonDataItem(id, type, body, name){
  const value = [id, type]
  const jsonData = {
    time: '',
    dataitem: []
  }

  // value.push(id)
  // value.push(type)

  if (body) {
    setTimeAndValue(jsonData, body, value)
  }

  jsonData.dataitem.push({ name, value })
  return jsonData
}

function * updateAsset () {
  const { id } = this.params
  const { device, type } = this.query
  const { body } = this.request
  const uuidCollection = common.getAllDeviceUuids(this.mtc.devices)
  const name = 'updateAsset'
  let uuid = common.getDeviceUuid(device)

  if ((uuid === undefined) && !R.isEmpty(uuidCollection)) {
    uuid = uuidCollection[0] // default device
  } else if (R.isEmpty(uuidCollection)) {
    return errResponse(this, this.request.type, 'NO_DEVICE', device)
  }

  const jsonData = jsonDataItem(id, type, body, name)
  const status = lokijs.updateAssetCollectionThruPUT(jsonData, uuid)

  if (status) {
    this.body = '<success/>\r\n'
    return true
  }
  this.body = '<failed/>\r\n'
  return false
}

module.exports = (router) => {
  router
    .get('assets', '/:device/assets/:ids', getAsset)
    .get('assets', '/:device/assets', getAsset)
    .get('assets', '/assets/:ids', getAsset)
    .get('/assets', getAsset)
    .post('/assets/:id', createAsset)
    .put('/assets/:id', updateAsset)
}
