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
    value: 'UNAVAILABLE',
    sequenceId: 13,
    time: '2' },
  { dataItemName: 'estop',
    uuid: '000',
    id: 'dtop_3',
    value: 'TRIGGERED',
    sequenceId: 14,
    time: '2' },
  { dataItemName: 'avail',
    uuid: '000',
    id: 'dtop_2',
    value: 'AVAILABLE',
    sequenceId: 15,
    time: '2' },
  { dataItemName: 'avail',
    uuid: '000',
    id: 'dtop_2',
    value: 'AVAILABLE',
    sequenceId: 16 ,
    time: '2'},
  { dataItemName: 'estop',
    uuid: '000',
    id: 'dtop_3',
    value: 'ARMED',
    sequenceId: 17,
    time: '2' },
  { dataItemName: 'avail',
    uuid: '000',
    id: 'dtop_2',
    value: 'UNAVAILABLE',
    sequenceId: 18,
    time: '2' },
  { dataItemName: 'estop',
    uuid: '000',
    id: 'dtop_3',
    value: 'TRIGGERED',
    sequenceId: 19,
    time: '2' },
  { dataItemName: 'estop',
    uuid: '000',
    id: 'dtop_3',
    value: 'ARMED',
    sequenceId: 20,
    time: '2' },
  { dataItemName: 'avail',
    uuid: '000',
    id: 'dtop_2',
    value: 'AVAILABLE',
    sequenceId: 21,
    time: '2'},
  { dataItemName: 'estop',
    uuid: '000',
    id: 'dtop_3',
    value: 'TRIGGERED',
    sequenceId: 22,
    time: '2'}];

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


const objJSON = { MTConnectStreams:
   { $:
      { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        xmlns: 'urn:mtconnect.org:MTConnectStreams:1.3',
        'xmlns:m': 'urn:mtconnect.org:MTConnectStreams:1.3',
        'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectStreams:1.3 http://www.mtconnect.org/schemas/MTConnectStreams_1.3.xsd' },
     Header:
      [{ $:
           { creationTime: '2015-02-11T12:12:57Z',
             assetBufferSize: '1024',
             sender: 'localhost',
             assetCount: '0',
             firstSequence: 0,
             lastSequence: 1,
             nextSequence: 2,
             version: '1.3',
             instanceId: '0',
             bufferSize: '524288',
             } }],
     Streams:
      [{ DeviceStream:
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
