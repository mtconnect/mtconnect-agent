/**
  * fns: shdrParsing, dataCollectionUpdate
  * postinsert circular buffer insertion and pointer updation
  */
const xmltojson = require('./xmltojson');
const egress = require('./egress');
const lokijs = require('./lokijs');
const util = require ('util');
const LRUMap = require('collections/lru-map');
const fs = require('fs');

const buffersize =10; // TODO: change it to the required buffer size
var sequenceid = 0; //TODO: sequenceid should be updated

/**
  * creates a database to store shdr value
  */
var shdr = lokijs.getshdrDB();
var shdrmap = new LRUMap( {},buffersize); /* circular buffer */

// TODO: insert the corresponding uuid
var uuid = 'innovaluesthailand_CINCOMA26-1_b77e26';

// TODO: corresponding id
var id ='dtop_2';

/**
  *string parsing and storing dataitemname and value from shdr
  */
function shdrParsing(shdrstring) {
  var shdrparse = shdrstring.split('|');
  var time = shdrparse[0];
  var totaldataitem = (shdrparse.length - 1) / 2;
  var dataitem = [];

  for (var i = 0, j = 1; i < totaldataitem; i++, j += 2) {
    // to getrid of edge conditions eg: 2016-04-12T20:27:01.0530|logic1|NORMAL||||
    if (shdrparse[j]){
      dataitem.push({ name: shdrparse[j], value: shdrparse[j+1] });
    }
  }
  return shdrdata = {
                      time,
                      dataitem,
                     };
}

/**
  *updating the circular buffer, first sequence and last sequence after every insert
  */
shdr.on('insert', function insertCallback(obj) {
  var keyarray = shdrmap.keys();

  if (keyarray.length === 0) {
    shdrmap.add({ dataitemname: obj.dataitemname, uuid:obj.uuid, id:obj.id, value: obj.value }, obj.sequenceid);
    keyarray = shdrmap.keys();
    firstsequence = keyarray[0];
    lastsequence = keyarray[0];
  } else if ((keyarray[0]) && (keyarray[buffersize-1]=== undefined)) {
    shdrmap.add({ dataitemname: obj.dataitemname, uuid:obj.uuid, id:obj.id, value: obj.value }, obj.sequenceid);
    keyarray = shdrmap.keys();
    firstsequence = keyarray[0];
    lastsequence = keyarray[keyarray.length-1];
  } else {
    keyarray = shdrmap.keys();
    shdrmap.add({dataitemname: obj.dataitemname, uuid:obj.uuid, id:obj.id, value: obj.value }, obj.sequenceid);
    keyarray = shdrmap.keys();
    firstsequence = keyarray[0];
    lastsequence = keyarray[buffersize-1];
  }

});

/**
  *inserting shdr data into data collection
  */
function dataCollectionUpdate(shdrarg) {
  var dataitemno = shdrarg.dataitem.length;

  for (var i = 0; i < dataitemno; i++) {
    shdr.insert({ sequenceid: sequenceid++, id: id, uuid: uuid, time: shdrarg.time,
                  dataitemname: shdrarg.dataitem[i].name, value: shdrarg.dataitem[i].value });
  }
  return  shdrmap;
}

// TODO : change this from here to schema reading section
shdr.insert({ sequenceid: sequenceid++, id: 'dtop_3',
              uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
              time: 2, dataitemname:'avail', value:'UNAVAILABLE' });
shdr.insert({ sequenceid: sequenceid++, id: 'dtop_3',
              uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
              time: 2, dataitemname:'estop', value:'ARMED' } );

module.exports = {
  shdrParsing,
  dataCollectionUpdate,
  shdrmap,
};
