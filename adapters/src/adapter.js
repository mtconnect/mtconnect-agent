// Adapter is device's SSDP server
// * broadcast UPnP
// Start doesn't tell us when server is ready
// https://github.com/diversario/node-ssdp/issues/70
// it is ok but unpredictable when testing

const log = require('./logger')
const { Server } = require('node-ssdp')

const ssdpOptions = {
  location: `http://${config.address}:${config.filePort}/`,
  udn: `uuid:${config.uuid}`,
  adInterval: 10000,
  allowWildcards: true
}

let server

function stop () {
  if (!server) return
  server.stop()
  server = false
}

// Start adapter
// @retrurns promise
function start () {
  // return immediately if server is running
  if (server) return new Promise((resolve, reject) => resolve())
  server = new Server(ssdpOptions)
  server.on('advertise-alive', log.debug.bind(log))
  server.on('advertise-bye', () => setImmediate(log.debug.bind(log)))
  server.on('error', log.error.bind(log))
  server.addUSN(`urn:schemas-mtconnect-org:service:${config.urn}:1`)
  process.on('exit', server.stop.bind(server))
  server.start()
  return new Promise((resolve, reject) => {
    if (!server.sock) reject()
    server.sock.once('listening', resolve)
    server.sock.once('error', reject)
  })
}

module.exports = { start, stop }
