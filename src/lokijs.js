// TODO Copyright, notice

const Loki = require('lokijs');
const Db = new Loki('loki.json');

// Constants

const shdr = Db.addCollection('SHDRCollection');
const mtcdevices = Db.addCollection('DeviceDefinition');

// Function header
function getshdrDB() {
  return shdr;
}

// Function header
function getschemaDB() {
  return mtcdevices;
}

// Exports

module.exports = {
  getshdrDB,
  getschemaDB,
};
