// File server
// * serves static files (unsure why)
//
const koa = require('koa')
const serve = require('koa-static')
const router = require('koa-router')()
const fs = require('fs')
const path = require('path')
const app = koa()
//app.use(serve(path.join(__dirname, '../../public')))

router.get('/', function*(){
	this.type = 'application/xml'
	this.body = fs.readFileSync('./public/VMC-3Axis1.xml', 'utf8')
})

app.use(router.routes())

module.exports = app
