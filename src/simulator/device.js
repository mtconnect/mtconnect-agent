const log = require('../config/logger');
const through = require('through');
// const common = require('../common');
const config = require('../config/config');
const byline = require('byline');
const koa = require('koa');
const app = koa();
const fs = require('fs');
const { inputFile, machinePort } = config.app.simulator;

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
  const lineFeed = byline.createStream(stream);
  this.body = lineFeed
    .on('error', this.onerror)
    .pipe(through(send, end));

  const socket = this.socket;

  function close() {
    lineFeed.unpipe();
    socket.removeListener('error', close);
    socket.removeListener('close', close);
  }

  socket.on('error', close);
  socket.on('close', close);
});


app.listen(machinePort, '0.0.0.0', () => log.info(`Running device on ${machinePort}`));
