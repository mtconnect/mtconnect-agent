// Adapter is device's SSDP server
// * broadcast UPnP
// Start doesn't tell us when server is ready
// https://github.com/diversario/node-ssdp/issues/70
// it is ok but unpredictable when testing

const log = require('./config/logger');
const config = require('./config/config');
const { agentPort, allowPut, AllowPutFrom } = config.app.agent;
const bodyparser = require('koa-bodyparser');
const aggregator = require('./aggregator');
const { handleRequest, requestErrorCheck } = require('./utils/handlers');
const koa = require('koa');
// const router = require('koa-router')();
// require('./routes')(router);
const app = koa();

app.use(bodyparser());
// app.use(router.routes()).use(router.allowedMethods());

app.use(function *(next) {
  const start = new Date();
  yield next;
  const ms = new Date() - start;
  console.info('%s %s - %s', this.method, this.url, ms);
});

app.use(function *() {
  const { req, res } = this;
  log.debug(`Request ${req.method} from ${req.host}:`);
  let acceptType;
  if (req.headers.accept) {
    acceptType = req.headers.accept;
  }
  const validRequest = requestErrorCheck(req, res, req.method, acceptType);
  if (validRequest) {
    return handleRequest(req, res);
  }
  return log.debug('error');
});

let server;

function start() {
  if (server) return new Promise((s) => s());
  aggregator.start();
  return new Promise((success) => {
    server = app.listen(agentPort, '0.0.0.0', () => {
      console.info(`Starting agent on port: ${agentPort}`);
      success();
    });
  });
}

function stop() {
  aggregator.stop();
  if (!server) return;
  server.close();
  server = false;
}

module.exports = { start, stop };
