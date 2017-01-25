const log = require('../config/logger');
const through = require('through');
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


// send sends line with a delay to the client
// line [String] single line of the input file
function send(line) {
  this.queue(line);
  this.pause();
  const to = setTimeout(() => {
    clearTimeout(to);
    this.resume();
  }, 1000);
}

// end finigshes the stream
function end() { this.queue(null); }

app.on('error', (err, ctx) => {
  log.error('server error', err, ctx);
});

app.use(function *response() {
  this.type = 'text/event-stream; charset=utf-8';
  this.set('Cache-Control', 'no-cache');
  this.set('Connection', 'keep-alive');
  const stream = fs.createReadStream(inputFile);
  this.body = byline.createStream(stream)
    .on('error', this.onerror)
    .pipe(through(send, end));
});


app.listen(machinePort, '0.0.0.0', () => log.info(`Running device on ${machinePort}`));
