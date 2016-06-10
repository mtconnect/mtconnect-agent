/**
  * fns: shdrParsing, dataCollectionUpdate
  * postinsert circular buffer insertion and pointer updation
  */
const lokijs = require('./lokijs');
const LRUMap = require('collections/lru-map');

const buffersize = 10; // TODO: change it to the required buffer size
let sequenceid = 0; // TODO: sequenceid should be updated

/**
  * creates a database to store shdr value
  */
const shdr = lokijs.getshdrDB();
const shdrmap = new LRUMap({}, buffersize); /* circular buffer */

// TODO: insert the corresponding uuid
const uuid = 'innovaluesthailand_CINCOMA26-1_b77e26';

// TODO: corresponding id
const id = 'dtop_2';

/**
  *string parsing and storing dataitemname and value from shdr
  */
function shdrParsing(shdrstring) {
  const shdrparse = shdrstring.split('|');
  // const time = shdrparse[0];
  const totaldataitem = (shdrparse.length - 1) / 2;
  // const dataitem = [];
  const shdrdata = {
    time: shdrparse[0],
    dataitem: [],
  };

  for (let i = 0, j = 1; i < totaldataitem; i++, j += 2) {
    // to getrid of edge conditions eg: 2016-04-12T20:27:01.0530|logic1|NORMAL||||
    if (shdrparse[j]) {
      shdrdata.dataitem.push({ name: shdrparse[j], value: shdrparse[j + 1] });
    }
  }
  return shdrdata;
}

/**
  *updating the circular buffer, first sequence and last sequence after every insert
  */
shdr.on('insert', (obj) => {
  let keyarray = shdrmap.keys();
  // let firstsequence = 0;
  // let lastsequence = 0;
  if (keyarray.length === 0) {
    shdrmap.add({ dataitemname: obj.dataitemname, uuid: obj.uuid, id: obj.id,
    value: obj.value }, obj.sequenceid);
    keyarray = shdrmap.keys();
    // firstsequence = keyarray[0];
    // lastsequence = keyarray[0];
  } else if ((keyarray[0]) && (keyarray[buffersize - 1] === undefined)) {
    shdrmap.add({ dataitemname: obj.dataitemname, uuid: obj.uuid,
    id: obj.id, value: obj.value }, obj.sequenceid);
    keyarray = shdrmap.keys();
    // firstsequence = keyarray[0];
    // lastsequence = keyarray[keyarray.length - 1];
  } else {
    keyarray = shdrmap.keys();
    shdrmap.add({ dataitemname: obj.dataitemname, uuid: obj.uuid, id: obj.id,
    value: obj.value }, obj.sequenceid);
    keyarray = shdrmap.keys();
    // firstsequence = keyarray[0];
    // lastsequence = keyarray[buffersize - 1];
  }
});

/**
  *inserting shdr data into data collection
  */
function dataCollectionUpdate(shdrarg) {
  const dataitemno = shdrarg.dataitem.length;

  for (let i = 0; i < dataitemno; i++) {
    shdr.insert({ sequenceid: sequenceid++, id, uuid, time: shdrarg.time,
                  dataitemname: shdrarg.dataitem[i].name, value: shdrarg.dataitem[i].value });
  }
  return shdrmap;
}

// TODO : change this from here to schema reading section
// shdr.insert({ sequenceid: sequenceid++, id: 'dtop_3',
//               uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
//               time: 2, dataitemname: 'avail', value: 'UNAVAILABLE' });
// shdr.insert({ sequenceid: sequenceid++, id: 'dtop_3',
//               uuid: 'innovaluesthailand_CINCOMA26-1_b77e26',
//               time: 2, dataitemname: 'estop', value: 'ARMED' });

module.exports = {
  shdrParsing,
  dataCollectionUpdate,
  shdrmap,
};
