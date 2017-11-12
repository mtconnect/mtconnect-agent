const { Client } = require('node-ssdp')
const jsdom = require('jsdom')

// SSDP Client – Refactor to discovery
const expect = require('unexpected').clone()
  .use(require('unexpected-stream'))
  .use(require('unexpected-dom'))

// Default to using simulator 1 for these tests
process.env.name = 'simulator1'

// Imports - Internal
const config = require('../../adapters/src/config')
const adapter = require('../../adapters/src/adapter')

describe('discovery', () => {
  describe('discovery using UPnP', () => {
    let client;
    
    beforeEach('start adapter', function * setup() {
      yield adapter.start()
      client = new Client()
      client.start()
      yield new Promise((resolve, reject) => {
        if (!client.sock) reject()
        client.sock.once('listening', resolve)
        client.sock.once('error', reject)
      })
    })
    afterEach('start adapter', () => {
      adapter.stop()
      client.stop()
    })
    
    it('should be found using UPnP', function (done) {
      this.timeout(4000)
      
      const lookup = 'urn:mtconnect-org:service:*'
      client.on('response', (headers) => {
        const {ST, LOCATION, USN} = headers
        expect(ST, 'to equal', lookup)
        expect(LOCATION, 'to equal', `http://${config.get('app:address')}:${config.get('app:filePort')}/`)
        expect(USN, 'to equal', `uuid:${config.get('app:uuid')}::urn:mtconnect-org:service:*`)
        client.stop()
        done()
      })
      client.search(lookup)
    })
  })
})
