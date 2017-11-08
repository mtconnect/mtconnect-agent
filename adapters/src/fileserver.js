// File server
// * serves static files (unsure why)
const config = require('./config')

const koa = require('koa')
const router = require('koa-router')()

const description = require('./description')
const renderXml = require('./render')
const app = koa()


router.get('/probe', function * () {
  this.type = 'application/xml'
  this.body = renderXml(config.get('app:deviceFile'))
})

router.get('/', function * () {
  this.type = 'application/xml'
  this.body = description()
})

app.use(router.routes())

module.exports = app
