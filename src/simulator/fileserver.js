// File server
// * serves static files (unsure why)
//
const koa = require('koa')
const serve = require('koa-static')
const router = require('koa-router')()
const fs = require('fs')
const path = require('path')
const app = koa()

router.get('/', function*(){
	this.type = 'application/xml'
	this.body = fs.readFileSync('./public/VMC-3Axis.xml', 'utf8')
	
})

app.use(router.routes())
//app.use(serve(path.join(__dirname, '../../public')))
module.exports = app
