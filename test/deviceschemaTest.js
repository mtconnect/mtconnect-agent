// Imports - External

const expect = require('expect.js');
const fs = require('fs');

// Imports - Internal

const deviceschema = require('../src/deviceschema');
const lokijs = require('../src/lokijs');
const schemaptr = lokijs.getschemaDB();


describe('Update device schema collection', () => {
  describe('updateSchemaCollection()', () => {
    it('should add a new device schema', () => {
      const schemaEntries = schemaptr.data.length;
      const schema = fs.readFileSync('./test/checkfiles/VMC-3Axis.xml', 'utf8');
      const ptr = deviceschema.updateSchemaCollection(schema);
      return expect(ptr.data.length).to.eql(schemaEntries + 1);
    });
    it('should not add a new device schema', () => {
      const schemaEntries = schemaptr.data.length;
      const schema = fs.readFileSync('./test/checkfiles/VMC-3Axis.xml', 'utf8');
      const ptr = deviceschema.updateSchemaCollection(schema);
      return expect(ptr.data.length).to.eql(schemaEntries);
    });
    it('should add a new device schema with updated details', () => {
      const schemaEntries = schemaptr.data.length;
      const schema = fs.readFileSync('./test/checkfiles/VMC-3Axis-copy.xml', 'utf8');
      const ptr = deviceschema.updateSchemaCollection(schema);
      return expect(ptr.data.length).to.eql(schemaEntries + 1);
    });
  });
});
