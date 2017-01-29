// File server
// * serves static files (unsure why)
//
const koa = require('koa');
const serve = require('koa-static');
const app = koa();

app.use(serve('public'));
module.exports = app;
