// File server
// * serves static files (unsure why)

const koa = require('koa')
const router = require('koa-router')()
const fs = require('fs')
const config = require('./config/config')
const description = require('../utils/description')
const app = koa()

router.get('/probe', function*(){
	this.type = 'application/xml'
	this.body = fs.readFileSync('./adapters/simulator/public/VMC-3Axis.xml', 'utf8')
})

router.get('/', function*(){
	this.type = 'application/xml'
	this.body = description(config)
	//this.body = fs.readFileSync('./adapters/simulator/public/description.xml', 'utf8')
})	

app.use(router.routes())

module.exports = app
