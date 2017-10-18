module.exports = (config) => {
return `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0" configId="123">
  <specVersion> 
    <major>1</major> 
    <minor>0</minor>
  </specVersion> 
  <URLBase>http://${config.address}:${config.filePort}</URLBase> 
  <device>
    <deviceType>urn:mtconnect.org:device:MTConnectDevices:1</deviceType>
    <friendlyName>${config.urn}</friendlyName>
    <manufacturer>${config.manufacturer}</manufacturer>
    <modelName>${config.modelName}</modelName>
    <serialNumber>${config.serialNumber}</serialNumber>
    <UDN>uuid:${config.uuid}</UDN>
    <iconList/> 
    <serviceList/>
  </device> 
</root>`
}