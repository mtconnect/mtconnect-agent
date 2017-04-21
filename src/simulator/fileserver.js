// File server
// * serves static files (unsure why)
//
const koa = require('koa')
const serve = require('koa-static')
const path = require('path')
const app = koa()
app.use(serve(path.join(__dirname, '../../public')))
module.exports = app
