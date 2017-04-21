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
  assetImplementation(this.res, idsA, type, Number(count), removed, (target || device), archetypeId, this.headers.accept)
}

function * createAsset () {
  const { id } = this.params
  const { device, type } = this.query
  const { body } = this.request
  const uuidCollection = common.getAllDeviceUuids(this.mtc.devices)
  let uuid = common.getDeviceUuid(device)
  if ((uuid === undefined) && !R.isEmpty(uuidCollection)) {
    uuid = uuidCollection[0] // default device
  } else if (R.isEmpty(uuidCollection)) {
    return errResponse(this.res, this.headers.accept, 'NO_DEVICE', device)
  }
  const value = []
  const jsonData = {
    time: '',
    dataitem: []
  }
  value.push(id)
  value.push(type)
  let keys
  if (body) {
    keys = R.keys(body)
    R.forEach((k) => {
      let time
      if (k === 'time') {
        time = R.pluck(k, [body])
        jsonData.time = time[0]
      }
      if (R.isEmpty(time)) {
        jsonData.time = moment.utc().format()
      }

      if (k === 'body') {
        const data = R.pluck(k, [body])
        value.push(data[0])
      }
    }, keys)
  }

  jsonData.dataitem.push({ name: 'addAsset', value })
  console.log(value, jsonData, uuid)
  const status = lokijs.addToAssetCollection(jsonData, uuid)

  if (status) {
    this.body = '<success/>\r\n'
    return false
  }
  this.body = '<failed/>\r\n'
  return false
}

function * updateAsset () {
  // const { id } = this.params
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
