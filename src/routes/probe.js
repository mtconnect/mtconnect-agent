const R = require('ramda')
const lokijs = require('../lokijs')
const { concatenateDevices, jsonToXML } = require('../jsonToXML')
const { errResponse } = require('../utils/handlers')
const common = require('../common')
const devices = require('../store')

function * probe () {
  // eg: reqPath = /sample?path=//Device[@name="VMC-3Axis"]//Hydraulic&from=97&count=5
  let uuidCollection

  // TODO: Also allow UUID
  if (!this.params.device) {
    uuidCollection = common.getAllDeviceUuids(devices)
  } else {
    uuidCollection = [common.getDeviceUuid(this.params.device)]
  }

  if (R.isEmpty(uuidCollection) || uuidCollection[0] === undefined) {
    return errResponse(this, this.request.type, 'NO_DEVICE', this.params.device)
  }
  const schema = R.map((uuid) => {
    const latestSchema = lokijs.searchDeviceSchema(uuid)
    return lokijs.probeResponse(latestSchema)
  }, uuidCollection)

  if (schema.length) {
    const json = concatenateDevices(schema)
    if (this.request.type === 'application/json') return (this.body = json)
    return jsonToXML(JSON.stringify(json), this)
  }
  return errResponse(this, this.request.type, 'UNSUPPORTED', this.url)
}

module.exports = (router) => {
  router
    .get('/probe', probe)
    .get('/:device/probe', probe)
}
