const koa = require('koa');
const serve = require('koa-static');
const config = require('../config/config');
const log = require('../config/logger');
const app = koa();
const { filePort } = config.app.simulator;

app.use(serve('public'));
app.listen(filePort, '0.0.0.0', () => {
  log.info(`File server started on ${filePort}`);
});
