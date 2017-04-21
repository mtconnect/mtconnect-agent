// devices absraction
const Loki = require('lokijs')
const Db = new Loki('agent-loki.json')
module.exports = Db.addCollection('devices')
