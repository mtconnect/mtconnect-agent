// Imports - External

const expect = require('expect.js');
const fs = require('fs');

// Imports - Internal

const xmltojson = require('../src/xmltojson');
const expectedjson = require('./checkfiles/samplejsonoutput');
const xml1 = fs.readFileSync('./test/checkfiles/Devices2di.xml', 'utf8');
const lokijs = require('../src/lokijs');

// constants

const insertedobject = {
  xmlns: { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  xmlns: 'urn:mtconnect.org:MTConnectDevices:1.3',
  'xmlns:m': 'urn:mtconnect.org:MTConnectDevices:1.3',
  'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectDevices:1.3 http://www.mtconnect.org/schemas/MTConnectDevices_1.3.xsd' },
  time: '2013-02-11T12:12:57Z',
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


describe('xml to json conversion', () => {
  describe('xmltojson()', () => {
    it('should convert xml with 2 dataitem correctly', () => {
      const check1 = xmltojson.convertToJSON(xml1);
      expect(check1).to.eql(expectedjson);
    });
  });
});


describe('inserting device schema', () => {
  describe(' insertschematoDB()', () => {
    it('should insert the devices schema json correctly', () => {
      const schemaPtr = lokijs.getschemaDB();
      schemaPtr.removeDataOnly();
      const jsonfile = fs.readFileSync('./test/checkfiles/jsonfile', 'utf8');
      const insert1 = xmltojson.insertSchemaToDB(JSON.parse(jsonfile));
      const checkdata = insert1.data[0];
      expect(checkdata.xmlns).to.eql(insertedobject.xmlns);
      expect(checkdata.time).to.eql(insertedobject.time);
      expect(checkdata.uuid).to.eql(insertedobject.uuid);
      expect(checkdata.device).to.eql(insertedobject.device);
    });
  });
});
