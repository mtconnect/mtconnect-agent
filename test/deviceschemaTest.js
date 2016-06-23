// Imports - External

const expect = require('expect.js');
const fs = require('fs');

// Imports - Internal

const lokijs = require('../src/lokijs');
const ioentries = require('./checkfiles/ioentries');
const samejson = require('./checkfiles/samplejsonoutput');
const differentjson = require('./checkfiles/samplejsonedited');

//Constants

 const schemaptr = lokijs.getSchemaDB();

//test - compareschema()

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


//test - updateSchemaCollection()

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
