// File server
// * serves static files (unsure why)

const koa = require('koa')
const router = require('koa-router')()
const fs = require('fs')
const app = koa()

router.get('/', function*(){
	this.type = 'application/xml'
	this.body = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
	
})

app.use(router.routes())

module.exports = app
