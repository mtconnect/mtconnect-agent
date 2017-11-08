const config = require('./config')

module.exports = () => {
return `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0" configId="123">
  <specVersion>
    <major>1</major>
    <minor>0</minor>
  </specVersion>
  <URLBase>http://${config.get('app:address')}:${config.get('app:filePort')}</URLBase>
  <device>
    <deviceType>urn:mtconnect.org:device:MTConnectDevices:1</deviceType>
    <friendlyName>${config.get('app:urn')}</friendlyName>
    <manufacturer>${config.get('app:manufacturer')}</manufacturer>
    <modelName>${config.get('app:modelName')}</modelName>
    <serialNumber>${config.get('app:serialNumber')}</serialNumber>
    <UDN>uuid:${config.get('app:uuid')}</UDN>
    <iconList/>
    <serviceList/>
  </device>
</root>`
}