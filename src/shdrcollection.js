/**
  * Copyright 2016, System Insights, Inc.
  *
  * Licensed under the Apache License, Version 2.0 (the "License");
  * you may not use this file except in compliance with the License.
  * You may obtain a copy of the License at
  *
  *    http://www.apache.org/licenses/LICENSE-2.0
  *
  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
  */

// TODO: rename the file to dataStorage
// Imports - Internal

const lokijs = require('./lokijs');
const common = require('./common');
const LRUMap = require('collections/lru-map');

// Constants

const buffersize = 10; // TODO: change it to the required buffer size
const shdr = lokijs.getshdrDB();

// Instances

const shdrmap = new LRUMap({}, buffersize); /* circular buffer */

// variables

let sequenceid = 0; // TODO: sequenceid should be updated

/**
  * getId() get the Id for the dataitem from the deviceschema
  *
  * @param {String} uuid
  * @param {String} dataItemName
  *
  * return id (Eg:'dtop_2')
  */
function getId(uuid, dataItemName) { // move to lokijs
  function isSameName(element) {
    if (element.$.name === dataItemName) {
      return true;
    }
    return false;
  }

  const schemaptr = lokijs.getschemaDB();
  // TODO: Can make a seperate function to find out recent entry from device schema collection
  const findUuid = schemaptr.chain()
                            .find({ uuid })
                            .data();
  const dataItemS = findUuid[0].device.DataItems[0];
  const dataItem = dataItemS.DataItem;
  const index = dataItem.findIndex(isSameName);
  const id = dataItem[index].$.id;
  return id;
}

/**
  * getUuid() returns the UUID
  *
  * @param  null
  *
  */
function getUuid() {
  const uuid = 'innovaluesthailand_CINCOMA26-1_b77e26'; // TODO: insert the corresponding uuid
  return uuid;
}

// TODO: corresponding id from getid

/**
  * shdrParsing get the data from adapter, do string parsing
  * @param {string} shdrParsing
  *
  * returns shdrdata with time and dataitem
  */
function shdrParsing(shdrstring) { // ('2014-08-11T08:32:54.028533Z|avail|AVAILABLE')
  const shdrparse = shdrstring.split('|');
  const totaldataitem = (shdrparse.length - 1) / 2;
  const shdrdata = {
    time: shdrparse[0],
    dataitem: [],
  };
  for (let i = 0, j = 1; i < totaldataitem; i++, j += 2) {
    // to getrid of edge conditions eg: 2016-04-12T20:27:01.0530|logic1|NORMAL||||
    if (shdrparse[j]) {
      // dataitem[i] = { name: (avail), value: (AVAILABLE) };
      shdrdata.dataitem.push({ name: shdrparse[j], value: shdrparse[j + 1] });
    }
  }
  return shdrdata;
}

/**
  * updating the circular buffer after every insertion into DB
  */
shdr.on('insert', (obj) => {
  let keyarray = shdrmap.keys();
  if (keyarray.length === 0) {
    shdrmap.add({ dataitemname: obj.dataitemname, uuid: obj.uuid, id: obj.id,
    value: obj.value }, obj.sequenceid);
    keyarray = shdrmap.keys();
  } else if ((keyarray[0]) && (keyarray[buffersize - 1] === undefined)) {
    shdrmap.add({ dataitemname: obj.dataitemname, uuid: obj.uuid,
    id: obj.id, value: obj.value }, obj.sequenceid);
    keyarray = shdrmap.keys();
  } else {
    keyarray = shdrmap.keys();
    shdrmap.add({ dataitemname: obj.dataitemname, uuid: obj.uuid, id: obj.id,
    value: obj.value }, obj.sequenceid);
    keyarray = shdrmap.keys();
  }
});

/**
  * dataCollectionUpdate() inserts the shdr data into the shdr collection
  *
  * @param {Object} shdrarg - with dataitem and time
  * returns a ptr to the circularbuffer
  */
function dataCollectionUpdate(shdrarg) { // TODO: move to lokijs
  const dataitemno = shdrarg.dataitem.length;
  const dataarr = common.fillArray(dataitemno);
  const uuid = getUuid();

  // Insert dataitems into the shdr collection one by one.
  // TODO: change back to for loop
  dataarr.map((i) => {
    const dataitemname = shdrarg.dataitem[i].name;
    const id = getId(uuid, dataitemname);
    shdr.insert({ sequenceid: sequenceid++, id, uuid, time: shdrarg.time,
                  dataitemname, value: shdrarg.dataitem[i].value });
    return true; // to make eslint happy
  });

  return shdrmap;
}

// Exports

module.exports = {
  getUuid,
  getId,
  shdrParsing,
  dataCollectionUpdate,
  shdrmap,
};
