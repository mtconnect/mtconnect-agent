var loki = require('lokijs');
var db = new loki('loki.json');

var shdr = db.addCollection('SHDRCollection');
var mtcdevices = db.addCollection('DeviceDefinition');

//Database creation
function getshdrDB() {
  var shdr = db.addCollection('SHDRCollection');
  return shdr;
}

function getschemaDB() {
  //Collections in DB
  var mtcdevices = db.addCollection('DeviceDefinition');
  return mtcdevices;
}

module.exports = {
                    getshdrDB,
                    getschemaDB,
                  };
