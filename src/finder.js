// Finder is a stream responsible for:
// * finding new devices on the network
// * emit new event when one found
// * consider setImmediate(func) to handle devices
const EventEmitter = require('events')
const { Client } = require('node-ssdp')
const { parseHeaders } = require('./utils')
const log = require('./config/logger')
const co = require('co')
const wait = require('co-wait')

class Finder extends EventEmitter {
  constructor ({ query, frequency }) {
    super()
    this.query = query
    this.frequency = frequency
    this.client = new Client()
    this.stop = this.stop.bind(this)
    this.search = this.search.bind(this)
    this.client.on('response', this.device.bind(this))
    this.client.on('error', log.error.bind(log))
  }

  device (data) {
    const info = parseHeaders(data)
    this.emit('device', info)
  }

  * search () {
    while (true) {
      log.debug(this.query)
      this.client.search(this.query)
      yield wait(this.frequency)
    }
  }

  start () {
    co(this.search).catch(log.error.bind(log))
  }

  stop () {
    this.client.stop()
  }
}

module.exports = Finder
