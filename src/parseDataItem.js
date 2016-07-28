const common = require('./common');
const Loki = require('lokijs');
const R = require('ramda');
const moment = require('moment');

// Imports - Internal

const dataStorage = require('./dataStorage');
const xmlToJSON = require('./xmlToJSON');
const lokijs = require('./lokijs')
const log = require('./config/logger');

// Constants

const rawData = lokijs.getRawDataDB();
const mtcDevices = lokijs.getSchemaDB();


function dataItemsParse(dataItems, dataItemName) {
  // function isSameName(element) {
  //   if (element.$.name === dataItemName) {
  //     return true;
  //   }
  //   return false;
  // }
  //
  // for (let i = 0; i < dataItems.length; i++) {
  //   const dataItem = dataItems[i].DataItem;
  //
  //   for (let j = 0; j < dataItem.length; j++) {
  //     if(dataItem[j] !== undefined) {
  //       const index = dataItem.findIndex(isSameName);
  //       if (index !== -1) {
  //         const id = dataItem[index].$.id;
  //         return id;
  //       }
  //     }
  //   }
  // }
}


function levelSixParse(container) {
  var dataItems;
  let id;
  for (let i = 0; i < container.length; i++) {
    const keys = R.keys(container[i]);

    // k = element of array keys
    R.find((k) => {
    // pluck the properties of all objects corresponding to k
      if ((R.pluck(k)([container[i]])) !== undefined) {
        const pluckedData = (R.pluck(k)([container[i]]))[0]; // result will be an array

        for (let j = 0; j < pluckedData.length; j++) {
          dataItems = pluckedData[j].DataItems;
          id = dataItemsParse(dataItems);
          return (id !== undefined );
        }
      }
       return 0; // to make eslint happy
    }, keys);
  }
  return id;
}

//start from arr and go back to function which calls this
/**
  * levelFiveParse()
  *
  *
  *
  */
function levelFiveParse(container) {
  let arr = [];
  for (let i = 0; i < container.length; i++) {
    if (container[i].Components !== undefined) {
      let j = 0;
      arr = levelSixParse(container[i].Components);
      return arr;
    }
    if (container[i].DataItems !== undefined) {
      return container[i].DataItems;
    }
  }

}


/**
  * getId() get the Id for the dataitem from the deviceSchema
  *
  * @param {String} uuid
  * @param {String} dataItemName
  *
  * return id (Eg:'dtop_2')
  */
function getDataItems(uuid) {
  let id;
  const findUuid = lokijs.searchDeviceSchema(uuid);
  const device = findUuid[findUuid.length-1].device;
  const dataItems = device.DataItems;
  const components = device.Components;
  if (dataItems !== undefined) {
    id = dataItemsParse(dataItems);
    if (id !== undefined) {
      return id;
    }
  }
  if(components !== undefined) {
    let axes = [];
    let systems = [];
    let controller = [];
    for (let i = 0; i < components.length; i++) {
      if (components[i].Axes !== undefined) {
        id = levelFiveParse(components[i].Axes);
        if (id !== undefined) {
          return id;
        }
      }
      if (components[i].Controller !== undefined) {
        id = levelFiveParse(components[i].Controller);
        if (id !== undefined) {
          return id;
        }
      }
      if (components[i].Systems !== undefined) {
        id = levelFiveParse(components[i].Systems);
        if (id !== undefined) {
          return id;
        }
      }
    }
  }

}

module.exports = {
  getDataItems,
};
