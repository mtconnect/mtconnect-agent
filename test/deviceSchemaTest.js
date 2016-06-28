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

// Imports - Internal

const lokijs = require('../src/lokijs');
const ioentries = require('./checkfiles/ioentries');
const samejson = require('./checkfiles/samplejsonoutput');
const differentjson = require('./checkfiles/samplejsonedited');

// Constants

const schemaptr = lokijs.getSchemaDB();

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


// test - updateSchemaCollection()

describe('Update device schema collection', () => {
  describe('updateSchemaCollection()', () => {
    it('should add a new device schema', () => {
      const schemaEntries = schemaptr.data.length;
      const schema = fs.readFileSync('./test/checkfiles/VMC-3Axis.xml', 'utf8');
      const ptr = lokijs.updateSchemaCollection(schema);
      return expect(ptr.data.length).to.eql(schemaEntries + 1);
    });
    it('should not add a new device schema', () => {
      const schemaEntries = schemaptr.data.length;
      const schema = fs.readFileSync('./test/checkfiles/VMC-3Axis.xml', 'utf8');
      const ptr = lokijs.updateSchemaCollection(schema);
      return expect(ptr.data.length).to.eql(schemaEntries);
    });
    it('should add a new device schema with updated details', () => {
      const schemaEntries = schemaptr.data.length;
      const schema = fs.readFileSync('./test/checkfiles/VMC-3Axis-copy.xml', 'utf8');
      const ptr = lokijs.updateSchemaCollection(schema);
      return expect(ptr.data.length).to.eql(schemaEntries + 1);
    });
  });
});
