/*
 * Copyright Copyright 2017, VIMANA, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

const config = require('./config')

module.exports = () => `<?xml version="1.0"?>
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
