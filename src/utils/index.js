const request = require('co-request');
const url = require('url');

module.exports = {
  // parseHeaders Parse headers returned by UPnP server into info
  // @params [Object] Headers from SSDP search
  // @returns [Object] device information
  parseHeaders({ LOCATION, USN }) {
    const [ip, port, filePort] = LOCATION.split(':');
    const [uuid] = USN.split(':');
    return { ip, port, filePort, uuid };
  },

  // deviceXML pulls device xml from the device
  // @params [Object] device info + path (xml location)
  // @returns [*function] generator function
  *deviceXML({ ip, filePort, path }) {
    const uri = {
      host: `${ip}:${filePort}`,
      pathname: path,
      protocol: 'http',
    };
    const result = yield request(url.format(uri));
    return result.body;
  },
};
