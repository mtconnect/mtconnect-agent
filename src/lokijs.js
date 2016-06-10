const Loki = require('lokijs');
const Db = new Loki('loki.json');

const shdr = Db.addCollection('SHDRCollection');
const mtcdevices = Db.addCollection('DeviceDefinition');

function getshdrDB() {
  return shdr;
}

function getschemaDB() {
  return mtcdevices;
}

module.exports = {
  getshdrDB,
  getschemaDB,
};
