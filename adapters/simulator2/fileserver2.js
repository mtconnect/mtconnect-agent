// File server
// * serves static files (unsure why)
//
const koa = require('koa')
const router = require('koa-router')()
const fs = require('fs')
const app = koa()

router.get('/probe', function*(){
	this.type = 'application/xml'
	this.body = fs.readFileSync('./adapters/simulator2/public/VMC-3Axis1.xml', 'utf8')
})

router.get('/', function*(){
	this.type = 'application/xml'
	this.body = fs.readFileSync('./adapters/simulator2/public/description.xml', 'utf8')
})

app.use(router.routes())

module.exports = app
