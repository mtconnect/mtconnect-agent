const fs = require('fs-ext')
const { Readable } = require('stream')
const BUFF_SIZE = 256

class InfReader extends Readable {
  constructor (options) {
    super(options)
    this.fd = fs.openSync(options.file, 'r')
    this.position = 0
    this.finish = this.finish.bind(this)
    this.onRead = this.onRead.bind(this)
    this._read = this._read.bind(this)
    this.readSource = this.readSource.bind(this)
    process.on('exit', this.finish)
    process.on('error', this.finish)
  }

  finish () {
    fs.close(this.fd)
  }
  // _read will be called when the stream wants to pull more data in
  // the advisory size argument is ignored in this case.
  onRead (err, bytes, readBuffer) {
    if (err) {
      return process.nextTick(() => this.emmit('error', err))
    }
    
    if (bytes < BUFF_SIZE) {
      this.position = 0
      const buff = readBuffer.slice(0, bytes)
      this.push(buff, 'utf-8')
      return this.push(Buffer.from(' '), 'utf-8')
    }
    this.position += bytes
    return this.push(readBuffer, 'utf-8')
  }

  readSource () {
    const readSize = BUFF_SIZE || 256
    fs.read(this.fd, Buffer.alloc(readSize), 0, readSize, this.position, this.onRead)
  }

  _read (size) {
    this.readSource(size)
  }
}

module.exports = InfReader
