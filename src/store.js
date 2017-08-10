// devices absraction
const Loki = require('lokijs')
const lokijs = require('./lokijs')

const Db = new Loki('agent-loki.json')
const devices = Db.addCollection('devices')

devices.on('delete', (obj) => {
  lokijs.updateBufferOnDisconnect(obj.uuid)
})

module.exports = devices
