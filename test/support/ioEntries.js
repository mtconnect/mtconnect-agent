const input1 = { time: '2',
          dataitem:
           [{ name: 'avail', value: 'ZERO' },
             { name: 'estop', value: 'ONE' },
             { name: 'avail', value: 'TWO' },
             { name: 'estop', value: 'THREE' },
             { name: 'avail', value: 'FOUR' },
             { name: 'estop', value: 'FIVE' },
             { name: 'avail', value: 'FIRST' },
             { name: 'estop', value: 'SIX' },
             { name: 'avail', value: 'SEVEN' },
             { name: 'avail', value: 'EIGHT' },
             { name: 'estop', value: 'NINE' },
             { name: 'avail', value: 'TEN' },
             { name: 'estop', value: 'ELEVEN' },
             { name: 'estop', value: 'TWELVE' },
             { name: 'avail', value: 'THIRTEEN' },
             { name: 'estop', value: 'LAST' }] };

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

const refSchema = [{ xmlns:
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
                    name: 'estop' } },
              { $:
                  { category: "EVENT",
                    id: "dev_asset_chg",
                    type: "ASSET_CHANGED" } },
              { $:
                  { category: "EVENT",
                    id: "dev_asset_rem",
                    type: "ASSET_REMOVED" } }
                  ] }] },
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
     [{ $: { name: 'VMC-3Axis', uuid: '000', id: 'dev' },
        ComponentStreams:
          [{ $: { component: 'Device', name: 'VMC-3Axis', componentId: 'dev' },
              Event:
               [{ $:
                    { type: 'AVAILABILITY',
                      category: 'EVENT',
                      id: 'dtop_2',
                      name: 'avail' },
                   _: 'AVAILABLE' }] }] }] }] } };

const newJSON = { MTConnectStreams:
   { '$':
      { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        xmlns: 'urn:mtconnect.org:MTConnectStreams:1.3',
        'xmlns:m': 'urn:mtconnect.org:MTConnectStreams:1.3',
        'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectStreams:1.3 http://www.mtconnect.org/schemas/MTConnectStreams1.3.xsd' },
     Header:
      [ { '$':
           { creationTime: '2016-08-09T13:11:18Z',
             assetBufferSize: '1024',
             sender: 'localhost',
             assetCount: '0',
             version: '1.3',
             instanceId: '0',
             bufferSize: '524288',
             nextSequence: 2,
             firstSequence: 0,
             lastSequence: 1 } } ],
     Streams:
      [ { DeviceStream:
           [ { '$': { name: 'VMC-3Axis', uuid: '000' },
               ComponentStreams:
                [ { '$': { component: 'Device', name: 'VMC-3Axis', componentId: 'dev' },
                    Events:
                     [ [ { Availability:
                            { '$':
                               { dataItemId: 'dtop_2',
                                 sequence: 0,
                                 timestamp: '2015-02-11T12:12:57Z',
                                 name: 'avail' },
                              _: 'UNAVAILABLE' } },
                         { EmergencyStop:
                            { '$':
                               { dataItemId: 'dtop_3',
                                 sequence: 1,
                                 timestamp: '2015-02-11T12:12:57Z',
                                 name: 'estop' },
                              _: 'UNAVAILABLE' } } ] ] } ] } ] } ] } };

const dataItemInitial = { Event:
                     [ { Availability:
                          { '$':
                             { dataItemId: 'dtop_2',
                               sequence: 0,
                               timestamp: '2015-02-11T12:12:57Z',
                               name: 'avail' },
                            _: 'UNAVAILABLE' } },
                       { EmergencyStop:
                          { '$':
                             { dataItemId: 'dtop_3',
                               sequence: 1,
                               timestamp: '2015-02-11T12:12:57Z',
                               name: 'estop' },
                            _: 'UNAVAILABLE' } } ],
                    Sample: [],
                    Condition: [] };
const dataItemWithVal = { Event:
                     [ { Availability:
                          { '$':
                             { dataItemId: 'dtop_2',
                               sequence: 2,
                               timestamp: '2015-02-11T12:12:57Z',
                               name: 'avail' },
                            _: 'AVAILABLE' } },
                       { EmergencyStop:
                          { '$':
                             { dataItemId: 'dtop_3',
                               sequence: 1,
                               timestamp: '2015-02-11T12:12:57Z',
                               name: 'estop' },
                            _: 'TRIGGERED' } } ],
                    Sample: [],
                    Condition: [] };

const slicedArray = [ [ { Availability:
                           { '$':
                              { dataItemId: 'dtop_2',
                                sequence: 132,
                                timestamp: '2016-07-25T05:50:28.303002Z',
                                name: 'avail' },
                             _: 'UNAVAILABLE' } },
                        { Availability:
                           { '$':
                              { dataItemId: 'dtop_2',
                                sequence: 134,
                                timestamp: '2016-07-25T05:50:29.303002Z',
                                name: 'avail' },
                             _: 'AVAILABLE' } } ],
                      [ { EmergencyStop:
                           { '$':
                              { dataItemId: 'dtop_3',
                                sequence: 130,
                                timestamp: '2016-07-25T05:50:21.313032Z',
                                name: 'estop' },
                             _: 'ARMED' } },
                        { EmergencyStop:
                           { '$':
                              { dataItemId: 'dtop_3',
                                sequence: 131,
                                timestamp: '2016-07-25T05:50:22.303002Z',
                                name: 'estop' },
                             _: 'TRIGGERED' } },
                        { EmergencyStop:
                           { '$':
                              { dataItemId: 'dtop_3',
                                sequence: 133,
                                timestamp: '2016-07-25T05:50:28.303002Z',
                                name: 'estop' },
                             _: 'TRIGGERED' } } ] ];

const  dataItemForSample = { Event:
   [ [ { Availability:
          { '$':
             { dataItemId: 'dtop_2',
               sequence: 18,
               timestamp: '2016-07-25T05:50:22.313002Z',
               name: 'avail' },
            _: 'UNAVAILABLE' } },
       { Availability:
          { '$':
             { dataItemId: 'dtop_2',
               sequence: 20,
               timestamp: '2016-07-25T05:50:23.303002Z',
               name: 'avail' },
            _: 'AVAILABLE' } },
       { Availability:
          { '$':
             { dataItemId: 'dtop_2',
               sequence: 22,
               timestamp: '2016-07-25T05:50:19.303002Z',
               name: 'avail' },
            _: 'UNAVAILABLE' } },
       { Availability:
          { '$':
             { dataItemId: 'dtop_2',
               sequence: 24,
               timestamp: '2016-07-25T05:50:24.303002Z',
               name: 'avail' },
            _: 'UNAVAILABLE' } },
       { Availability:
          { '$':
             { dataItemId: 'dtop_2',
               sequence: 26,
               timestamp: '2016-07-25T05:50:21.303022Z',
               name: 'avail' },
            _: 'AVAILABLE' } },
       { Availability:
          { '$':
             { dataItemId: 'dtop_2',
               sequence: 27,
               timestamp: '2016-07-25T05:50:19.303002Z',
               name: 'avail' },
            _: 'UNAVAILABLE' } } ],
     [ { EmergencyStop:
          { '$':
             { dataItemId: 'dtop_3',
               sequence: 19,
               timestamp: '2016-07-25T05:50:20.303002Z',
               name: 'estop' },
            _: 'ARMED' } },
       { EmergencyStop:
          { '$':
             { dataItemId: 'dtop_3',
               sequence: 21,
               timestamp: '2016-07-25T05:50:23.303002Z',
               name: 'estop' },
            _: 'ARMED' } },
       { EmergencyStop:
          { '$':
             { dataItemId: 'dtop_3',
               sequence: 23,
               timestamp: '2016-07-25T05:50:20.303002Z',
               name: 'estop' },
            _: 'ARMED' } },
       { EmergencyStop:
          { '$':
             { dataItemId: 'dtop_3',
               sequence: 25,
               timestamp: '2016-07-25T05:50:19.303012Z',
               name: 'estop' },
            _: 'TRIGGERED' } } ] ],
  Sample: [],
  Condition: [] };

const dataItemForCount = { Event:
   [ [ { Availability:
          { '$':
             { dataItemId: 'dtop_2',
               sequence: 18,
               timestamp: '2016-07-25T05:50:22.313002Z',
               name: 'avail' },
            _: 'UNAVAILABLE' } } ],
     [ { EmergencyStop:
          { '$':
             { dataItemId: 'dtop_3',
               sequence: 19,
               timestamp: '2016-07-25T05:50:20.303002Z',
               name: 'estop' },
            _: 'ARMED' } }
       ] ],
  Sample: [],
  Condition: [] };

const arrToPathFilter = [
  { dataItemName: 'Yact',
    uuid: '000',
    id: 'y2',
    value: 'UNAVAILABLE',
    sequenceId: 4,
    time: '2010-03-04T18:44:40+00:00',
    path: '//Devices//Device[@name="VMC-3Axis"]//Axes//Linear//DataItem[@type="POSITION" and @subType="ACTUAL"]',
    checkPoint: null },
  { dataItemName: 'Xact',
    uuid: '000',
    id: 'x2',
    value: 'UNAVAILABLE',
    sequenceId: 3,
    time: '2010-03-04T18:44:40+00:00',
    path: '//Devices//Device[@name="VMC-3Axis"]//Axes//Linear//DataItem[@type="POSITION" and @subType="REAL"]',
    checkPoint: null },
  { dataItemName: 'power',
    uuid: '000',
    id: 'p2',
    value: 'UNAVAILABLE',
    sequenceId: 8,
    time: '2010-03-04T18:44:40+00:00',
    path: '//Devices//Device[@name="VMC-3Axis"]//Systems//Electric//DataItem[@type="POWER_STATE"]',
    checkPoint: null } ];

let assetData = [ { time: '2016-07-25T05:50:19.303002Z',
    assetId: 'EM233',
    uuid: '000',
    target:'VMC-3Axis',
    assetType: 'CuttingTool',
    removed: false,
    value: '<CuttingTool serialNumber="ABC" toolId="10" assetId="ABC"><Description></Description><CuttingToolLifeCycle>'+
    '<ToolLife countDirection="UP" limit="0" type="MINUTES">160</ToolLife><Location type="POT">10</Location><Measurements>'+
    '<FunctionalLength code="LF" minimum="0" nominal="3.7963">3.7963</FunctionalLength>'+
    '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>' },
  { time: '2016-07-25T05:50:25.303002Z',
    assetId: 'EM262',
    uuid: '000',
    target: 'VMC-3Axis',
    assetType: 'Garbage',
    removed: false,
    value: '<CuttingTool serialNumber="XYZ" toolId="11" assetId="XYZ"><Description></Description><CuttingToolLifeCycle>'+
    '<ToolLife countDirection="UP" limit="0" type="MINUTES">341</ToolLife><Location type="POT">11</Location><Measurements>'+
    '<FunctionalLength code="LF" minimum="0" nominal="4.12213">4.12213</FunctionalLength>'+
    '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>' },
  { time: '2016-07-25T05:50:22.303002Z',
    assetId: 'ST1',
    uuid: '000',
    target: 'ABC',
    assetType: 'CuttingTool',
    removed: true,
    value: '<CuttingTool serialNumber="FOO" toolId="12" assetId="FOO"><Description></Description><CuttingToolLifeCycle>'+
    '<ToolLife countDirection="UP" limit="0" type="MINUTES">360</ToolLife><Location type="POT">12</Location><Measurements>'+
    '<FunctionalLength code="LF" minimum="0" nominal="5.83029">5.83029</FunctionalLength>'+
    '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>' } ]
module.exports = {
  input1,
  insertedObject,
  schema,
  refSchema,
  schemaTimeDiff,
  objJSON,
  newJSON,
  dataItemInitial,
  dataItemWithVal,
  dataItemForSample,
  dataItemForCount,
  slicedArray,
  arrToPathFilter,
  assetData,
};
