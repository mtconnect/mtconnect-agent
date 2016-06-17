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

const output1 = [{ dataitemname: 'avail',
    uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
    id: 'dtop_2',
    value: 'UNAVAILABLE' },
  { dataitemname: 'estop',
    uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
    id: 'dtop_3',
    value: 'TRIGGERED' },
  { dataitemname: 'avail',
    uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
    id: 'dtop_2',
    value: 'AVAILABLE' },
  { dataitemname: 'avail',
    uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
    id: 'dtop_2',
    value: 'AVAILABLE' },
  { dataitemname: 'estop',
    uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
    id: 'dtop_3',
    value: 'ARMED' },
  { dataitemname: 'avail',
    uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
    id: 'dtop_2',
    value: 'UNAVAILABLE' },
  { dataitemname: 'estop',
    uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
    id: 'dtop_3',
    value: 'TRIGGERED' },
  { dataitemname: 'estop',
    uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
    id: 'dtop_3',
    value: 'ARMED' },
  { dataitemname: 'avail',
    uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
    id: 'dtop_2',
    value: 'AVAILABLE' },
  { dataitemname: 'estop',
    uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
    id: 'dtop_3',
    value: 'TRIGGERED' }];

const insertedobject = {
  xmlns: { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  xmlns: 'urn:mtconnect.org:MTConnectDevices:1.3',
  'xmlns:m': 'urn:mtconnect.org:MTConnectDevices:1.3',
  'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectDevices:1.3 http://www.mtconnect.org/schemas/MTConnectDevices_1.3.xsd' },
  time: '2015-02-11T12:12:57Z',
  uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
  device: { $:
   { name: 'innovaluesthailand_CINCOMA26-1',
     uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
     id: 'CINCOMA26-1_1' },
  Description:
   [{ _: 'Cincom A26 - CINCOM A26',
       $: { model: 'Cincom A26', manufacturer: 'Citizen' } }],
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
    name: 'innovaluesthailand_CINCOMA26-1',
    uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
    device:
     { $:
        { name: 'innovaluesthailand_CINCOMA26-1',
          uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
          id: 'CINCOMA26-1_1' },
       Description:
        [{ _: 'Cincom A26 - CINCOM A26',
            $: { model: 'Cincom A26', manufacturer: 'Citizen' } }],
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
                { name: 'innovaluesthailand_CINCOMA26-1',
                  uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
                  id: 'CINCOMA26-1_1' },
               Description:
                [{ _: 'Cincom A26 - CINCOM A26',
                    $: { model: 'Cincom A26', manufacturer: 'Citizen' } }],
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
  insertedobject,
  schema,
  objJSON,
};
