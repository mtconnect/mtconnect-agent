// Device - actual device
// * emits data over http via http/event-stream

const log = require('../config/logger');
const through = require('through');
// const common = require('../common');
const config = require('../config/config');
// const byline = require('byline');
const es = require('event-stream');
const koa = require('koa');
const app = koa();
const InfStream = require('../utils/infstream');
const { inputFile } = config.app.simulator;

// send sends line with a delay to the client
// line [String] single line of the input file
// TODO: update stream to be infinent
function send(line) {
  this.queue(line);
  this.pause();
  const to = setTimeout(() => {
    clearTimeout(to);
    this.resume();
  }, 1000);
}

// end finigshes the stream
function end() {
  this.queue(null);
}

app.on('error', (err, ctx) => {
  log.error('server error', err, ctx);
});

app.use(function *response() {
  this.type = 'text/event-stream; charset=utf-8';
  this.set('Cache-Control', 'no-cache');
  this.set('Connection', 'keep-alive');

  this.body = (new InfStream({ file: inputFile }))
    .on('error', log.error.bind(log))
    .pipe(es.split('\n'))
    .pipe(through(send, end));

  const socket = this.socket;
  function close() {
    socket.removeListener('error', close);
    socket.removeListener('close', close);
  }
  socket.on('error', close);
  socket.on('close', close);
});

module.exports = app;
