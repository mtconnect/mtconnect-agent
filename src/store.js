// devices absraction
const Loki = require('lokijs')

const Db = new Loki('agent-loki.json')
const devices = Db.addCollection('devices')

module.exports = devices
