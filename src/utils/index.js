const request = require('co-request')
const parse = require('xml-parser')

module.exports = {
  // parseHeaders Parse headers returned by UPnP server into info
  // @params [Object] Headers from SSDP search
  // @returns [Object] device information
  parseHeaders ({ LOCATION, USN }) {
    const [ip, port, filePort ] = LOCATION.split(':')
    const [uuid] = USN.split(':')
    return { ip, port, filePort, uuid }
  },

  // deviceXML pulls device xml from the device
  // @params [Object] device info + path (xml location)
  // @returns [*function] generator function
  * descriptionXML ({ ip, port, filePort }) {
    if (!(ip && port && filePort)) throw new Error('Missing required arguments')
    const { body } = yield request(`http://${ip}:${filePort}`)
    return body
  },

  * deviceXML(description){
    const url = parse(description).root.children[1].content
    const { body } = yield request(`${url}/probe`)
    return body
  }
}
