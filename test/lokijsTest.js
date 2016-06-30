/**
  * Copyright 2016, System Insights, Inc.
  *
  * Licensed under the Apache License, Version 2.0 (the "License");
  * you may not use this file except in compliance with the License.
  * You may obtain a copy of the License at
  *
  *    http://www.apache.org/licenses/LICENSE-2.0
  *
  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
  */

// Imports - External

const expect = require('expect.js');
const fs = require('fs');
const R = require('ramda');

// Imports - Internal

const ioentries = require('./checkfiles/ioentries');
const dataStorage = require('../src/dataStorage');
const lokijs = require('../src/lokijs');
const samejson = require('./checkfiles/samplejsonoutput');
const differentjson = require('./checkfiles/samplejsonedited');


// constants
const schemaptr = lokijs.getSchemaDB();
const uuid = '000';
const result1 = { time: '2014-08-11T08:32:54.028533Z',
dataitem: [{ name: 'avail', value: 'AVAILABLE' }] };

const input1 = ioentries.input1;
const output1 = ioentries.output1;
const dbresult1 = [{ dataItemName: 'avail',
                uuid: '000',
                id: 'dtop_2',
                value: 'AVAILABLE' }];

const insertedobject = {
  xmlns: { 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  xmlns: 'urn:mtconnect.org:MTConnectDevices:1.3',
  'xmlns:m': 'urn:mtconnect.org:MTConnectDevices:1.3',
  'xsi:schemaLocation': 'urn:mtconnect.org:MTConnectDevices:1.3 http://www.mtconnect.org/schemas/MTConnectDevices_1.3.xsd' },
  time: '2013-02-11T12:12:57Z',
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


// test - insertSchemaToDB()

describe('inserting device schema', () => {
  describe(' insertSchematoDB()', () => {
    it('should insert the devices schema json correctly', () => {
      const schemaPtr = lokijs.getSchemaDB();
      schemaPtr.removeDataOnly();
      const jsonfile = fs.readFileSync('./test/checkfiles/jsonfile', 'utf8');
      lokijs.insertSchemaToDB(JSON.parse(jsonfile));
      const checkdata = schemaPtr.data[0];
      expect(checkdata.xmlns).to.eql(insertedobject.xmlns);
      expect(checkdata.time).to.eql(insertedobject.time);
      expect(checkdata.uuid).to.eql(insertedobject.uuid);
      expect(checkdata.device).to.eql(insertedobject.device);
    });
  });
});


describe('To get Id', () => {
  describe('getId()', () => {
    it('should give correct Id', () => {
      expect(lokijs.getId(uuid, 'avail')).to.eql('dtop_2');
      expect(lokijs.getId(uuid, 'estop')).to.eql('dtop_3');
    });
  });
});


// test - compareschema()

describe('Compare lokijs with same uuid from collection with new schema', () => {
  describe('compareSchema()', () => {
    it('should return true as the schema already exist', () => {
      const check = lokijs.compareSchema(ioentries.schema, samejson);
      expect(check).to.eql(true);
    });
    it('should return false as the schema already exist', () => {
      const check = lokijs.compareSchema(ioentries.schema, differentjson);
      expect(check).to.eql(false);
    });
  });
});


describe('Check the device schema to get the recent data', () => {
  describe('searchDeviceSchema()', () => {
    it('should give the  recent device schema present in data base', () => {
      const schemaPtr = lokijs.getSchemaDB();
      schemaPtr.removeDataOnly();
      const xml1 = fs.readFileSync('E:/connect-agent/test/checkfiles/Devices2di.xml', 'utf8');
      lokijs.updateSchemaCollection(xml1);
      const schema = lokijs.searchDeviceSchema(uuid);
      const refschema = ioentries.schema[0];
      return expect(schema[0].device).to.eql(refschema.device);
    });
  });
});


// TODO edit the test

describe('datainsertion', () => {
  describe('dataCollectionUpdate()', () => {
    const schema = fs.readFileSync('./test/checkfiles/Devices2di.xml', 'utf8');
    const cb = dataStorage.circularBuffer;
    lokijs.updateSchemaCollection(schema);
    it('should insert single dataitem in database and update circular buffer', () => {
      dataStorage.circularBuffer.clear();
      lokijs.dataCollectionUpdate(result1);
      const check1Obj = cb.toObject();
      const buffer1 = R.values(check1Obj);
      return expect(buffer1).to.eql(dbresult1);
    });
    it('should insert more than 10 dataitem in database and update circular buffer', () => {
      dataStorage.circularBuffer.clear();
      lokijs.dataCollectionUpdate(input1);
      const check2Obj = cb.toObject();
      const buffer2 = R.values(check2Obj);
      return expect(buffer2).to.eql(output1);
    });
  });
});


describe('Update device schema collection', () => {
  const ptr = lokijs.getSchemaDB();
  describe('updateSchemaCollection()', () => {
    it('should add a new device schema', () => {
      const schemaEntries = schemaptr.data.length;
      const schema = fs.readFileSync('./test/checkfiles/VMC-3Axis.xml', 'utf8');
      lokijs.updateSchemaCollection(schema);
      return expect(ptr.data.length).to.eql(schemaEntries + 1);
    });
    it('should not add a new device schema', () => {
      const schemaEntries = schemaptr.data.length;
      const schema = fs.readFileSync('./test/checkfiles/VMC-3Axis.xml', 'utf8');
      lokijs.updateSchemaCollection(schema);
      return expect(ptr.data.length).to.eql(schemaEntries);
    });
    it('should add a new device schema with updated details', () => {
      const schemaEntries = schemaptr.data.length;
      const schema = fs.readFileSync('./test/checkfiles/VMC-3Axis-copy.xml', 'utf8');
      lokijs.updateSchemaCollection(schema);
      return expect(ptr.data.length).to.eql(schemaEntries + 1);
    });
  });
});
