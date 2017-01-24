const log = require('../config/logger');
const { PassThrough } = require('stream');
// const common = require('../common');
const config = require('../config/config');
const byline = require('byline');
const koa = require('koa');
const app = koa();
const fs = require('fs');
const { inputFile, machinePort } = config.app.simulator;

/**
  * writeDataLoop() sends machine data to the Agent in loop
  *
  * @param {Object} socket
  * @param {Object} count
  * @param {Object} delay
  */
// function writeDataLoop(socket, countValue, delay) {
//   let count = countValue;
//   while (count) {
//     lineReader.eachLine(inputFile, (line) => {
//       setTimeout(() => {
//         try {
//           socket.write(`${line}\n`);
//         } catch (e) {
//           common.processError(`Error: ${e}`, false);
//         }
//       }, Math.floor(Math.random() * delay)); // Simulate delay
//     });
//     count = count - 1;
//   }
// }


/**
 * Simulator (adapter)
 */

// machine.on('connection', (socket) => {
//   log.debug('Machine connected');
//   writeDataLoop(socket, 100, 10000);
//   socket.on('data', (data) => {
//     console.log('Received:', data.toString());
//   })
// });

// machine.on('error', (err) => {
//   common.processError(`${err}`, true);
// });

// logger

app.use(function *logger(next) {
  const start = new Date;
  yield next;
  const ms = new Date - start;
  log.info('%s %s - %s', this.method, this.url, ms);
});

// response

const stream = fs.createReadStream(inputFile);

app.use(function *response() {
  this.body = byline.createStream(stream)
    .on('error', this.onerror)
    .pipe(PassThrough());
});

app.listen(machinePort);
console.info(`starting server on localhost:${machinePort}`);
