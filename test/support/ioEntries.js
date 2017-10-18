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
    uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef',
    device:
     { $:
        { name: 'VMC-3Axis',
          uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef',
          id: 'dev' },
       Description:
           [{ $: { manufacturer: 'SystemInsights' } }],
       DataItems:
        [{ DataItem:
             [{ $:
                  { type: 'AVAILABILITY',
                    category: 'EVENT',
                    id: 'ifdFcfPh1C',
                    name: 'avail' } },
               { $:
                  { type: 'EMERGENCY_STOP',
                    category: 'EVENT',
                    id: 'BA3qjkMgS5',
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
    uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef',
    device:
     { $:
        { name: 'VMC-3Axis',
          uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef',
          id: 'dev' },
       Description:
           [{ $: { manufacturer: 'SystemInsights' } }],
       DataItems:
        [{ DataItem:
             [{ $:
                  { type: 'AVAILABILITY',
                    category: 'EVENT',
                    id: 'ifdFcfPh1C',
                    name: 'avail' } },
               { $:
                  { type: 'EMERGENCY_STOP',
                    category: 'EVENT',
                    id: 'BA3qjkMgS5',
                    name: 'estop' } },
              { $:
                  { category: 'EVENT',
                    id: 'CQeVl0V5Yg',
                    name: 'assetChange',
                    type: 'ASSET_CHANGED' } },
              { $:
                  { category: 'EVENT',
                    id: 'aQDjJbsJMQ',
                    name: 'assetRemove',
                    type: 'ASSET_REMOVED' } },
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
   { $:
      { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        xmlns: 'urn:mtconnect.org:MTConnectStreams:1.3',
        'xmlns:m': 'urn:mtconnect.org:MTConnectStreams:1.3',
        'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectStreams:1.3 http://www.mtconnect.org/schemas/MTConnectStreams1.3.xsd' },
     Header:
      [{ $:
           { creationTime: '2016-08-09T13:11:18Z',
             assetBufferSize: '1024',
             sender: 'localhost',
             assetCount: '0',
             version: '1.3',
             instanceId: '0',
             bufferSize: '524288',
             nextSequence: 2,
             firstSequence: 0,
             lastSequence: 1 } }],
     Streams:
      [{ DeviceStream:
           [{ $: { name: 'VMC-3Axis', uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef' },
               ComponentStreams:
                [{ $: { component: 'Device', name: 'VMC-3Axis', componentId: 'dev' },
                    Events:
                     [[{ Availability:
                            { $:
                               { dataItemId: 'ifdFcfPh1C',
                                 sequence: 0,
                                 timestamp: '2015-02-11T12:12:57Z',
                                 name: 'avail' },
                              _: 'UNAVAILABLE' } },
                         { EmergencyStop:
                            { $:
                               { dataItemId: 'BA3qjkMgS5',
                                 sequence: 1,
                                 timestamp: '2015-02-11T12:12:57Z',
                                 name: 'estop' },
                              _: 'UNAVAILABLE' } }]] }] }] }] } };

const dataItemInitial = { Event:
                     [{ Availability:
                          { $:
                             { dataItemId: 'ifdFcfPh1C',
                               sequence: 0,
                               timestamp: '2015-02-11T12:12:57Z',
                               name: 'avail' },
                            _: 'UNAVAILABLE' } },
                       { EmergencyStop:
                          { $:
                             { dataItemId: 'BA3qjkMgS5',
                               sequence: 1,
                               timestamp: '2015-02-11T12:12:57Z',
                               name: 'estop' },
                            _: 'UNAVAILABLE' } }],
                    Sample: [],
                    Condition: [] };
const dataItemWithVal = { Event:
                     [{ Availability:
                          { $:
                             { dataItemId: 'ifdFcfPh1C',
                               sequence: 2,
                               timestamp: '2015-02-11T12:12:57Z',
                               name: 'avail' },
                            _: 'AVAILABLE' } },
                       { EmergencyStop:
                          { $:
                             { dataItemId: 'BA3qjkMgS5',
                               sequence: 1,
                               timestamp: '2015-02-11T12:12:57Z',
                               name: 'estop' },
                            _: 'TRIGGERED' } }],
                    Sample: [],
                    Condition: [] };

const slicedArray = [[{ Availability:
                           { $:
                              { dataItemId: 'dtop_2',
                                sequence: 132,
                                timestamp: '2016-07-25T05:50:28.303002Z',
                                name: 'avail' },
                             _: 'UNAVAILABLE' } },
                        { Availability:
                           { $:
                              { dataItemId: 'dtop_2',
                                sequence: 134,
                                timestamp: '2016-07-25T05:50:29.303002Z',
                                name: 'avail' },
                             _: 'AVAILABLE' } }],
                      [{ EmergencyStop:
                           { $:
                              { dataItemId: 'dtop_3',
                                sequence: 130,
                                timestamp: '2016-07-25T05:50:21.313032Z',
                                name: 'estop' },
                             _: 'ARMED' } },
                        { EmergencyStop:
                           { $:
                              { dataItemId: 'dtop_3',
                                sequence: 131,
                                timestamp: '2016-07-25T05:50:22.303002Z',
                                name: 'estop' },
                             _: 'TRIGGERED' } },
                        { EmergencyStop:
                           { $:
                              { dataItemId: 'dtop_3',
                                sequence: 133,
                                timestamp: '2016-07-25T05:50:28.303002Z',
                                name: 'estop' },
                             _: 'TRIGGERED' } }]];

const dataItemForSample = { Event:
   [[{ Availability:
          { $:
             { dataItemId: 'ifdFcfPh1C',
               sequence: 18,
               timestamp: '2016-07-25T05:50:22.313002Z',
               name: 'avail' },
            _: 'UNAVAILABLE' } },
       { Availability:
          { $:
             { dataItemId: 'ifdFcfPh1C',
               sequence: 20,
               timestamp: '2016-07-25T05:50:23.303002Z',
               name: 'avail' },
            _: 'AVAILABLE' } },
       { Availability:
          { $:
             { dataItemId: 'ifdFcfPh1C',
               sequence: 22,
               timestamp: '2016-07-25T05:50:19.303002Z',
               name: 'avail' },
            _: 'UNAVAILABLE' } },
       { Availability:
          { $:
             { dataItemId: 'ifdFcfPh1C',
               sequence: 24,
               timestamp: '2016-07-25T05:50:24.303002Z',
               name: 'avail' },
            _: 'UNAVAILABLE' } },
       { Availability:
          { $:
             { dataItemId: 'ifdFcfPh1C',
               sequence: 26,
               timestamp: '2016-07-25T05:50:21.303022Z',
               name: 'avail' },
            _: 'AVAILABLE' } },
       { Availability:
          { $:
             { dataItemId: 'ifdFcfPh1C',
               sequence: 27,
               timestamp: '2016-07-25T05:50:19.303002Z',
               name: 'avail' },
            _: 'UNAVAILABLE' } }],
     [{ EmergencyStop:
          { $:
             { dataItemId: 'BA3qjkMgS5',
               sequence: 19,
               timestamp: '2016-07-25T05:50:20.303002Z',
               name: 'estop' },
            _: 'ARMED' } },
       { EmergencyStop:
          { $:
             { dataItemId: 'BA3qjkMgS5',
               sequence: 21,
               timestamp: '2016-07-25T05:50:23.303002Z',
               name: 'estop' },
            _: 'ARMED' } },
       { EmergencyStop:
          { $:
             { dataItemId: 'BA3qjkMgS5',
               sequence: 23,
               timestamp: '2016-07-25T05:50:20.303002Z',
               name: 'estop' },
            _: 'ARMED' } },
       { EmergencyStop:
          { $:
             { dataItemId: 'BA3qjkMgS5',
               sequence: 25,
               timestamp: '2016-07-25T05:50:19.303012Z',
               name: 'estop' },
            _: 'TRIGGERED' } }]],
  Sample: [],
  Condition: [] };

const dataItemForCount = { Event:
   [[{ Availability:
          { $:
             { dataItemId: 'ifdFcfPh1C',
               sequence: 18,
               timestamp: '2016-07-25T05:50:22.313002Z',
               name: 'avail' },
            _: 'UNAVAILABLE' } }],
     [{ EmergencyStop:
          { $:
             { dataItemId: 'BA3qjkMgS5',
               sequence: 19,
               timestamp: '2016-07-25T05:50:20.303002Z',
               name: 'estop' },
            _: 'ARMED' } },
       ]],
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
    checkPoint: null }];

const assetData = [{ time: '2016-07-25T05:50:19.303002Z',
    assetId: 'EM233',
    uuid: '000',
    target: 'VMC-3Axis',
    assetType: 'CuttingTool',
    removed: false,
    value: '<CuttingTool serialNumber="ABC" toolId="10" assetId="ABC"><Description></Description><CuttingToolLifeCycle>' +
    '<ToolLife countDirection="UP" limit="0" type="MINUTES">160</ToolLife><Location type="POT">10</Location><Measurements>' +
    '<FunctionalLength code="LF" minimum="0" nominal="3.7963">3.7963</FunctionalLength>' +
    '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>' },
  { time: '2016-07-25T05:50:25.303002Z',
    assetId: 'EM262',
    uuid: '000',
    target: 'VMC-3Axis',
    assetType: 'Garbage',
    removed: false,
    value: '<CuttingTool serialNumber="XYZ" toolId="11" assetId="XYZ"><Description></Description><CuttingToolLifeCycle>' +
    '<ToolLife countDirection="UP" limit="0" type="MINUTES">341</ToolLife><Location type="POT">11</Location><Measurements>' +
    '<FunctionalLength code="LF" minimum="0" nominal="4.12213">4.12213</FunctionalLength>' +
    '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>' },
  { time: '2016-07-25T05:50:22.303002Z',
    assetId: 'ST1',
    uuid: '000',
    target: 'ABC',
    assetType: 'CuttingTool',
    removed: true,
    value: '<CuttingTool serialNumber="FOO" toolId="12" assetId="FOO"><Description></Description><CuttingToolLifeCycle>' +
    '<ToolLife countDirection="UP" limit="0" type="MINUTES">360</ToolLife><Location type="POT">12</Location><Measurements>' +
    '<FunctionalLength code="LF" minimum="0" nominal="5.83029">5.83029</FunctionalLength>' +
    '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>' }];

const assetValueJSON = { CuttingTool:
   { $: { serialNumber: 'ABC', toolId: '10', assetId: 'ABC' },
     CuttingToolLifeCycle:
      [{ CutterStatus: [{ Status: ['NEW'] }],
          ToolLife:
           [{ _: '160',
               $: { countDirection: 'UP', limit: '0', type: 'MINUTES' } }],
          Location: [{ _: '10', $: { type: 'POT' } }],
          Measurements:
           [{ FunctionalLength:
                [{ _: '3.7963',
                    $: { code: 'LF', minimum: '0', nominal: '3.7963' } }],
               CuttingDiameterMax: [{ _: '0', $: { code: 'DC', minimum: '0', nominal: '0' } }] }] }] } };


const devices = {
                name: 'devices',
                data:
                 [ { address: '192.168.1.7',
                     port: '7879',
                     uuid: '43444e50-a578-11e7-a3dd-28cfe91a82ef',
                     meta: { revision: 0, created: 1479183143392, version: 0 },
                     '$loki': 1 } ],
                idIndex: [ 1 ],
                binaryIndices: {},
                constraints: { unique: {}, exact: {} },
                uniqueNames: [],
                transforms: {},
                objType: 'devices',
                dirty: true,
                cachedIndex: null,
                cachedBinaryIndex: null,
                cachedData: null,
                transactional: false,
                cloneObjects: false,
                cloneMethod: 'parse-stringify',
                asyncListeners: false,
                disableChangesApi: true,
                autoupdate: false,
                ttl: { age: null, ttlInterval: null, daemon: null },
                maxId: 1,
                DynamicViews: [],
               };
const multiStreamError  = { MTConnectError:
   { '$':
      { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        xmlns: 'urn:mtconnect.org:MTConnectError:1.3',
        'xmlns:m': 'urn:mtconnect.org:MTConnectError:1.3',
        'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectError:1.3 http://www.mtconnect.org/schemas/MTConnectError1.3.xsd' },
     Header:
      [ { '$':
           { creationTime: '2016-11-16T07:17:56Z',
             sender: 'localhost',
             instanceId: 101,
             bufferSize: '10',
             version: 1.3 } } ],
     Errors:
      [ { '$': {},
          Error:
           [ { '$': { errorCode: 'OUT_OF_RANGE' },
               _: 'Client can\'t keep up with event stream, disconnecting' } ] } ] } };
const multiStreamError1  = { MTConnectError:
  { '$':
     { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
       xmlns: 'urn:mtconnect.org:MTConnectError:1.3',
       'xmlns:m': 'urn:mtconnect.org:MTConnectError:1.3',
       'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectError:1.3 http://www.mtconnect.org/schemas/MTConnectError1.3.xsd' },
    Header:
     [ { '$':
          { creationTime: '2016-11-16T07:17:56Z',
            sender: 'localhost',
            instanceId: 101,
            bufferSize: '10',
            version: 1.3 } } ],
    Errors:
     [ { '$': {},
         Error:
          [ { '$': { errorCode: 'OUT_OF_RANGE' },
              _: `from value must be less than or equal to 1200, disconnecting.` } ] } ] } };
const unsupportedErr  = { MTConnectError:
  { '$':
     { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
       xmlns: 'urn:mtconnect.org:MTConnectError:1.3',
       'xmlns:m': 'urn:mtconnect.org:MTConnectError:1.3',
       'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectError:1.3 http://www.mtconnect.org/schemas/MTConnectError1.3.xsd' },
    Header:
     [ { '$':
          { creationTime: '2016-11-16T07:17:56Z',
            sender: 'localhost',
            instanceId: 101,
            bufferSize: '10',
            version: 1.3 } } ],
    Errors:
     [ { '$': {},
         Error:
          [ { '$': { errorCode: 'UNSUPPORTED' },
              _: 'Unsupported put error' } ] } ] } };
module.exports = {
  devices,
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
  assetValueJSON,
  multiStreamError,
  multiStreamError1,
  unsupportedErr,
};
