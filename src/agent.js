// Adapter is device's SSDP server
// * broadcast UPnP
// Start doesn't tell us when server is ready
// https://github.com/diversario/node-ssdp/issues/70
// it is ok but unpredictable when testing

/*
 * Copyright Copyright 2017, VIMANA, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */


const config = require('./configuration');
const log = config.logger;
const {agentPort, AllowPutFrom, allowPut} = config.get('app:output:http');
//const { agentPort, AllowPutFrom, allowPut } = config.app.agent;
const bodyparser = require('koa-bodyparser');
const aggregator = require('./aggregator');
const koa = require('koa');
const xml = require('koa-xml-body').default;
const router = require('koa-router')();
require('./routes')(router);
const app = koa();
const devices = require('./store');
const {handleRequest, validRequest, parseIP, logging} = require('./utils/handlers');

// Set up handle to store state
app.use(function* setupMTC(next) {
    this.mtc = {devices};
    yield next;
});

app.use(xml());
app.use(bodyparser());
app.use(parseIP());
app.use(logging());
app.use(validRequest({AllowPutFrom, allowPut}));
app.use(router.routes()).use(router.allowedMethods());
app.use(handleRequest);

// Error handling
// errors rased perculate upto here
app.on('error', (err) => {
    log.error('sent error %s to the cloud', err.message);
    log.error(err);
});

// try yielding route if fails handle response
// emit 'error' event
// custom handling goes here
app.use(function* lastResort(next) {
    try {
        yield next;
    } catch (err) {
        // some errors will have .status
        // however this is not a guarantee
        this.status = err.status || 500;
        this.type = 'html';
        this.body = '<p>Something <em>exploded</em></p>';

        // since we handled this manually we'll
        // want to delegate to the regular app
        // level error handling as well so that
        // centralized still functions correctly.
        this.app.emit('error', err, this);
    }
});


let server;

function start() {
    if (server) return new Promise((resolve, reject) => resolve());
    aggregator.start();
    return new Promise((resolve, reject) => {
        server = app.listen(agentPort, '0.0.0.0', () => {
            log.debug(`Starting agent on port: ${agentPort}`);
            resolve();
        });
    });
}

function stop() {
    aggregator.stop();
    if (!server) return;
    server.close();
    server = false;
}

module.exports = {start, stop};
