const probe = require('./probe')
const sample = require('./sample')
const assets = require('./assets')
const current = require('./current')
const schema = require('./schema')

module.exports = (router) => {
  probe(router)
  assets(router)
  sample(router)
  current(router)
  schema(router)
}
