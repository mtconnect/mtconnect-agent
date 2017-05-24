const R = require('ramda')
const { currentImplementation, giveResponse, errResponse, handleMultilineStream, validityCheck } = require('../utils/handlers')
const common = require('../common')
const devices = require('../store')

function * current () {
  // eg: reqPath = /sample?path=//Device[@name="VMC-3Axis"]//Hydraulic&from=97&count=5
  let uuidCollection
  console.log('1--------------1')
  console.log(this.res.req)
  console.log('1--------------1')
  if (!this.params.device) {
    uuidCollection = common.getAllDeviceUuids(devices)
  } else {
    uuidCollection = [common.getDeviceUuid(this.params.device)]
  }

  if (R.isEmpty(uuidCollection) || uuidCollection[0] === undefined) {
    return errResponse(this.res, this.headers.accept, 'NO_DEVICE', this.params.device)
  }

  // TODO: implement casting for params parsing
  // default values will fail validation system
  // consider using db gateway for casting
  // start params parser
  const at = Number(this.query.at) || undefined
  const path = this.query.path
  const freq = Number(this.query.frequency) || Number(this.query.interval) || undefined

  if (freq) {
    if (at) {
      return errResponse(
        this.res,
        this.headers.accept,
        'INVALID_REQUEST'
      )
    }
    return handleMultilineStream(
      this,
      path,
      uuidCollection,
      freq,
      'current',
      at,
      undefined,
      this.headers.accept
    )
  }
  // end params parser

  const obj = validityCheck('current', uuidCollection, path, at)
  if (obj.valid) {
    const jsonData = currentImplementation(this.res, this.headers.accept, at, path, uuidCollection)
    return giveResponse(jsonData, this.headers.accept, this.res)
  }
  return errResponse(this.res, this.headers.accept, 'validityCheck', obj.errorJSON)
}

module.exports = (router) => {
  router
    .get('/current', current)
    .get('/:device/current', current)
}
