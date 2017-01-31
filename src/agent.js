// Adapter is device's SSDP server
// * broadcast UPnP
// Start doesn't tell us when server is ready
// https://github.com/diversario/node-ssdp/issues/70
// it is ok but unpredictable when testing

const log = require('../config/logger');
const config = require('../config/config');
const ip = require('ip').address();
const { uuid, urn, machinePort, filePort } = config.app.simulator;
const { urnSearch, agentPort, path, allowPut, AllowPutFrom } = config.app.agent;
const koa = requrie('koa');
const app = koa();


function defineAgentServer() { // TODO check for requestType 'get' and 'put'
  // handles all the incoming request
  queryError = false;
  app.use(bodyParser.urlencoded({ extended: true, limit: 10000 }));
  app.use(bodyParser.json());

  app.all('*', (req, res) => {
    log.debug(`Request ${req.method} from ${req.get('host')}:`)
    let acceptType;
    if (req.headers.accept) {
      acceptType = req.headers.accept;
    }
    const validRequest = requestErrorCheck(res, req.method, acceptType);
    if (validRequest) {
      return handleRequest(req, res);
    }
    return log.debug('error');
  });
}


function start() {
  return new Promise((success) => app.listen(agentPort, ip, success));
}

function stop() {
  app.close();
}

module.exports = { start, stop };
