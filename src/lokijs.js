var loki = require('lokijs');

//Database creation
function getDB(){
  var db = new loki('loki.json');
  var shdr = db.addCollection('SHDRCollection');
  return shdr;
}

module.exports = {getDB};
