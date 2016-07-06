const input1 = { time: '2',
          dataitem:
           [{ name: 'avail', value: 'UNAVAILABLE' },
             { name: 'estop', value: 'ARMED' },
             { name: 'avail', value: 'AVAILABLE' },
             { name: 'estop', value: 'ARMED' },
             { name: 'avail', value: 'UNAVAILABLE' },
             { name: 'estop', value: 'TRIGGERED' },
             { name: 'avail', value: 'UNAVAILABLE' },
             { name: 'estop', value: 'TRIGGERED' },
             { name: 'avail', value: 'AVAILABLE' },
             { name: 'avail', value: 'AVAILABLE' },
             { name: 'estop', value: 'ARMED' },
             { name: 'avail', value: 'UNAVAILABLE' },
             { name: 'estop', value: 'TRIGGERED' },
             { name: 'estop', value: 'ARMED' },
             { name: 'avail', value: 'AVAILABLE' },
             { name: 'estop', value: 'TRIGGERED' }] };

const output1 = [{ dataItemName: 'avail',
    uuid: '000',
    id: 'dtop_2',
    value: 'UNAVAILABLE' },
  { dataItemName: 'estop',
    uuid: '000',
    id: 'dtop_3',
    value: 'TRIGGERED' },
  { dataItemName: 'avail',
    uuid: '000',
    id: 'dtop_2',
    value: 'AVAILABLE' },
  { dataItemName: 'avail',
    uuid: '000',
    id: 'dtop_2',
    value: 'AVAILABLE' },
  { dataItemName: 'estop',
    uuid: '000',
    id: 'dtop_3',
    value: 'ARMED' },
  { dataItemName: 'avail',
    uuid: '000',
    id: 'dtop_2',
    value: 'UNAVAILABLE' },
  { dataItemName: 'estop',
    uuid: '000',
    id: 'dtop_3',
    value: 'TRIGGERED' },
  { dataItemName: 'estop',
    uuid: '000',
    id: 'dtop_3',
    value: 'ARMED' },
  { dataItemName: 'avail',
    uuid: '000',
    id: 'dtop_2',
    value: 'AVAILABLE' },
  { dataItemName: 'estop',
    uuid: '000',
    id: 'dtop_3',
    value: 'TRIGGERED' }];

const insertedObject = {
  xmlns: { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  xmlns: 'urn:mtconnect.org:MTConnectDevices:1.3',
  'xmlns:m': 'urn:mtconnect.org:MTConnectDevices:1.3',
  'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectDevices:1.3 http://www.mtconnect.org/schemas/MTConnectDevices_1.3.xsd' },
  time: '2015-02-11T12:12:57Z',
  uuid: '000',
  device: { $:
   { name: 'VMC-3Axis',
     uuid: '000',
     id: 'dev' },
  Description:
      [{ $: { manufacturer: 'SystemInsights' } }],
  DataItems:
   [{ DataItem:
        [{ $:
             { type: 'AVAILABILITY',
               category: 'EVENT',
               id: 'dtop_2',
               name: 'avail' } },
          { $:
             { type: 'EMERGENCY_STOP',
               category: 'EVENT',
               id: 'dtop_3',
               name: 'estop' } }] }] },
};

const schema = [{ xmlns:
     { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
       xmlns: 'urn:mtconnect.org:MTConnectDevices:1.3',
       'xmlns:m': 'urn:mtconnect.org:MTConnectDevices:1.3',
       'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectDevices:1.3 http://www.mtconnect.org/schemas/MTConnectDevices_1.3.xsd' },
    time: '2015-02-11T12:12:57Z',
    name: 'VMC-3Axis',
    uuid: '000',
    device:
     { $:
        { name: 'VMC-3Axis',
          uuid: '000',
          id: 'dev' },
       Description:
           [{ $: { manufacturer: 'SystemInsights' } }],
       DataItems:
        [{ DataItem:
             [{ $:
                  { type: 'AVAILABILITY',
                    category: 'EVENT',
                    id: 'dtop_2',
                    name: 'avail' } },
               { $:
                  { type: 'EMERGENCY_STOP',
                    category: 'EVENT',
                    id: 'dtop_3',
                    name: 'estop' } }] }] },
    meta: { revision: 0, created: 1466074574525, version: 0 },
    $loki: 1 }];


const schemaTimeDiff = [{ xmlns:
     { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
       xmlns: 'urn:mtconnect.org:MTConnectDevices:1.3',
       'xmlns:m': 'urn:mtconnect.org:MTConnectDevices:1.3',
       'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectDevices:1.3 http://www.mtconnect.org/schemas/MTConnectDevices_1.3.xsd' },
    time: '2016-02-11T12:12:57Z',
    name: 'VMC-3Axis',
    uuid: '000',
    device:
     { $:
        { name: 'VMC-3Axis',
          uuid: '000',
          id: 'dev' },
       Description:
           [{ $: { manufacturer: 'SystemInsights' } }],
       DataItems:
        [{ DataItem:
             [{ $:
                  { type: 'AVAILABILITY',
                    category: 'EVENT',
                    id: 'dtop_2',
                    name: 'avail' } },
               { $:
                  { type: 'EMERGENCY_STOP',
                    category: 'EVENT',
                    id: 'dtop_3',
                    name: 'estop' } }] }] },
    meta: { revision: 0, created: 1466074574525, version: 0 },
    $loki: 1 }];


const objJSON = { MTConnectDevices:
   { $:
      { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        xmlns: 'urn:mtconnect.org:MTConnectDevices:1.3',
        'xmlns:m': 'urn:mtconnect.org:MTConnectDevices:1.3',
        'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectDevices:1.3 http://www.mtconnect.org/schemas/MTConnectDevices_1.3.xsd' },
     Header:
      [{ $:
           { creationTime: '2015-02-11T12:12:57Z',
             assetBufferSize: '1024',
             sender: 'localhost',
             assetCount: '0',
             version: '1.3',
             instanceId: '0',
             bufferSize: '524288' } }],
     Devices:
      [{ Device:
           [{ $:
                { name: 'VMC-3Axis',
                  uuid: '000',
                  id: 'dev' },
               Description:
                [{ $: { manufacturer: 'SystemInsights' } }],
               DataItems:
                [{ DataItem:
                     [{ $:
                          { type: 'AVAILABILITY',
                            category: 'EVENT',
                            id: 'dtop_2',
                            name: 'avail' },
                         _: 'AVAILABLE' }] }] }] }] } };

module.exports = {
  input1,
  output1,
  insertedObject,
  schema,
  schemaTimeDiff,
  objJSON,
};
