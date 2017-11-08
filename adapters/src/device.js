// Device - actual device
// * emits data over http via http/event-stream

const config = require('./config')
const log = config.logger

const net = require('net')
const LineByLine = require('line-by-line')

function device(file) {
  return net.createServer((socket) => {
    socket.setNoDelay(true)
    socket.name = `${socket.remoteaddress}:${socket.remotePort}`
    
    // Create a line reader.
    const reader = new LineByLine(file)
    reader.on('error', err => {
      log.error(err);
    })
    
    // TODO: Should restart reader at the beginning.
    reader.on('end', () => {
      socket.close()
      log.info('End of file')
    })
    
    // Send each line with the current timestamp.
    // TODO: need to honor timestamps delta to simulate real interval.
    reader.on('line', line => {
      reader.pause()
      
      const fields = line.split('|')
      const ts = fields.shift()
      fields.unshift((new Date()).toISOString())
      
      socket.write(`${fields.join('|')}\n`)
      setTimeout(() => {
        reader.resume()
      }, 1000)
    })
  
    // Implement Ping/Pong protocol for heartbeats.
    socket.on('data', data => {
      log.info(`Received: '${data}'`)
      console.log(`------- Received: '${data}'`)
      if (data.toString().match(/^\* PING/)) {
        socket.write('* PONG 10000\n')
      }
    })
  
    // if the socket closes or errors, stop the reader.
    socket.on('end', () => {
      log.info('Socket closed')
      reader.close()
    })
  
    socket.on('error', (err, ctx) => {
      log.warn(`Socket error: ${err}`)
      reader.close()
    })
  })
}

module.exports = device
