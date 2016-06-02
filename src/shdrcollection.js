/* creates a database to store shdr value */
const lokijs = require('./lokijs');
const util = require ('util');
const LRUMap = require('collections/lru-map');
const fs = require('fs');

const xmltojson = require('./xmltojson');
const egress = require('./egress');
const buffersize =10; // TODO: change it to the required buffer size
var sequenceid = 0; // sequenceid should be updated

var shdr = lokijs.getshdrDB();
var shdrmap = new LRUMap({},buffersize);

shdr.insert( {sequenceid: sequenceid++, id: 'dtop_2', uuid: 'innovaluesthailand_CINCOMA26-1_b77e26', time: 2, dataitemname:'avail', value:'UNAVAILABLE' } );
shdr.insert( {sequenceid: sequenceid++, id: 'dtop_2', uuid: 'innovaluesthailand_CINCOMA26-1_b77e26', time: 2, dataitemname:'estop', value:'ARMED' } );

//string parsing and storing dataitemname and value from shdr
function shdrparsing(shdrstring) {

    var shdrparse = shdrstring.split('|');
    var time = shdrparse[0];
    var totaldataitem = (shdrparse.length - 1)/ 2;
    var dataitem = [];

    for (var i =0, j =1; i < totaldataitem; i++, j+=2){
      if(shdrparse[j] !== '' ){ // to getrid of edge conditions eg: 2016-04-12T20:27:01.0530|logic1|NORMAL||||
          dataitem.push({ name: shdrparse[j], value: shdrparse[j+1] });
      }
    }
    return shdrdata = { time: time, dataitem: dataitem }  ;
}

//updating the circular buffer, first sequence and last sequence after every insert
shdr.on('insert', function insertCallback(obj) {
  var keyarray = shdrmap.keys();
  if(keyarray.length === 0 ){
      shdrmap.add({dataitemname: obj.dataitemname, val: obj.value}, obj.sequenceid);
      keyarray = shdrmap.keys();
      firstsequence = keyarray[0];
      lastsequence = keyarray[0];

  }
  else if ((keyarray[0]!== undefined) && (keyarray[buffersize-1]=== undefined)) {
    shdrmap.add({dataitemname: obj.dataitemname, val: obj.value}, obj.sequenceid);
    keyarray = shdrmap.keys();
    firstsequence = keyarray[0];
    lastsequence = keyarray[keyarray.length-1];

  }
  else { //if ((keyarray[0]!== undefined) && (keyarray[buffersize-1] !== undefined))

    keyarray = shdrmap.keys();
    shdrmap.add({dataitemname: obj.dataitemname, val: obj.value}, obj.sequenceid);
    keyarray = shdrmap.keys();
    firstsequence = keyarray[0];
    lastsequence = keyarray[buffersize-1];

  }

});

//inserting shdr data into data collection
function datacollectionupdate( shdrarg ) {
    var uuid = 'innovaluesthailand_CINCOMA26-1_b77e26'; // the corresponding uuid
    var id ='dtop_2'
    var dataitemno = shdrarg.dataitem.length;
    for (var i = 0; i < dataitemno; i++){
      shdr.insert( {sequenceid: sequenceid++, id: id, uuid: uuid, time: shdrarg.time, dataitemname: shdrarg.dataitem[i].name, value: shdrarg.dataitem[i].value} );
    }
    return  shdr;
}

// var parseddata = shdrparsing(shdrstring);
// var inserteddata = datacollectionupdate(parseddata);
// var xml = fs.readFileSync('../test/checkfiles/Devices2di.xml','utf8');
// var jsonobj = xmltojson.xmltojson(xml);
// var xmlschema = xmltojson.insertschematoDB(jsonobj);
// var name = xmlschema.data[0].device.$.name;
// var jsondata = egress.searchdeviceschema(name, xmlschema, inserteddata);
// var json2xml = egress.jsontoxml(JSON.stringify(jsondata), '../test/checkfiles/result.xml');

module.exports = {
  shdrparsing,
  datacollectionupdate,
  shdr,
};
