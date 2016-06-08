var loki = require('lokijs');
var db = new loki('loki.json');

var shdr = db.addCollection('SHDRCollection');
var mtcdevices = db.addCollection('DeviceDefinition');
function getshdrDB() {
  return shdr;
}

function getschemaDB() {
  //Collections in DB
  return mtcdevices;
}

module.exports = {
                    getshdrDB,
                    getschemaDB,
                 };
