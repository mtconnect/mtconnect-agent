// File server
// * serves static files (unsure why)
const koa = require('koa')
const router = require('koa-router')()
// const config = require('./config/config')
const description = require('../utils/description')
const renderXml = require('../utils/render')
const app = koa()


router.get('/probe', function*(){
	this.type = 'application/xml'
	this.body = renderXml(config.deviceFile, config)
})

router.get('/', function*(){
	this.type = 'application/xml'
	this.body = description(config)
})	

app.use(router.routes())

module.exports = app
