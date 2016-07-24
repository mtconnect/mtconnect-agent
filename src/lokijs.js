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

// TODO: Use module import/export

// Imports - External

const common = require('./common');
const Loki = require('lokijs');
const R = require('ramda');
const moment = require('moment');

// Imports - Internal

const dataStorage = require('./dataStorage');
const xmlToJSON = require('./xmlToJSON');
const log = require('./config/logger');

// Instances

const Db = new Loki('loki.json');

// Constants - datacollection pointers

const rawData = Db.addCollection('rawData');
const mtcDevices = Db.addCollection('DeviceDefinition');

// variables

let sequenceId = 0; // TODO: sequenceId should be updated

/* ********************** support functions *************************** */
/**
  * initaiteCircularBuffer() inserts default value for each dataitem (from the schema)
  * in to the database which in turn updates circular buffer
  *
  * @param = {object} dataitemS: dataItems for each devices in  schema
  * @param = {String} time: time from deviceSchema
  * @param = {String} uuid: UUID from deviceSchema
  */

function initaiteCircularBuffer(dataItems, time, uuid) {
  const numberofDataItems = dataItems.length;
  for (let k = 0; k < numberofDataItems; k++) {
    const numberofDataItem = dataItems[k].DataItem.length;
    for (let l = 0; l < numberofDataItem; l++) {
      const dataItem = dataItems[k].DataItem[l].$;
      const dataItemName = dataItem.name;
      const id = dataItem.id;
      rawData.insert({ sequenceId: sequenceId++, id, uuid, time,
                     dataItemName, value: 'UNAVAILABLE' });
    }
  }
}


/* ********************** Parsing schema ******************************** */

/**
  * parseAxesComponents() parse the components in schema
  *
  * @param = {Object} components (from schema level 6)
  * @param = {String} time (of schema reception)
  * @param = {uuid} UUID of the device
  */

function parseAxesComponents(axesComponents, timeVal, uuid) {
  for (let i = 0; i < axesComponents.length; i++) {
    if (axesComponents[i].Rotary !== undefined) {
      const rotary = axesComponents[i].Rotary;
      for (let j = 0; j < rotary.length; j++) {
        initaiteCircularBuffer(rotary[j].DataItems, timeVal, uuid);
      }
    }
    if (axesComponents[i].Linear !== undefined) {
      const linear = axesComponents[i].Linear;
      for (let j = 0; j < linear.length; j++) {
        initaiteCircularBuffer(linear[j].DataItems, timeVal, uuid);
      }
    }
  }
}

/**
  * parseAxes() parse the Axes in schema
  *
  * @param = {Object} axes (from schema level 5)
  * @param = {String} time (of schema reception)
  * @param = {uuid} UUID of the device
  */
function parseAxes(axes, timeVal, uuid) {
  for (let i = 0; i < axes.length; i++) {
    if (axes[i].Components !== undefined) {
      parseAxesComponents(axes[i].Components, timeVal, uuid);
    }
    if (axes[i].DataItems !== undefined) {
      initaiteCircularBuffer(axes[i].DataItems, timeVal, uuid);
    }
  }
}


/**
  * parseController() parse the Controller in schema
  *
  * @param = {Object} controller (from schema level 5)
  * @param = {String} time (of schema reception)
  * @param = {uuid} UUID of the device
  */
function parseController(controller, timeVal, uuid) {
  for (let i = 0; i < controller.length; i++) {
    if (controller[i].Components !== undefined) {
      const components = controller[i].Components;
      for (let j = 0; j < components.length; j++) {
        const path = components[j].Path;
        for (let k = 0; k < path.length; k++) {
          initaiteCircularBuffer(path[j].DataItems, timeVal, uuid);
        }
      }
    }
    if (controller[i].DataItems !== undefined) {
      initaiteCircularBuffer(controller[i].DataItems, timeVal, uuid);
    }
  }
}


/**
  * parseSystemsComponents() parse the Systems in schema
  *
  * @param = {Object} components (from schema level 6)
  * @param = {String} time (of schema reception)
  * @param = {uuid} UUID of the device
  */
function parseSystemsComponents(components, timeVal, uuid) {
  for (let i = 0; i < components.length; i++) {
    if (components[i].Electric !== undefined) {
      const electric = components[i].Electric;
      for (let j = 0; j < electric.length; j++) {
        initaiteCircularBuffer(electric[j].DataItems, timeVal, uuid);
      }
    }

    if (components[i].Coolant !== undefined) {
      const coolant = components[i].Coolant;
      for (let j = 0; j < coolant.length; j++) {
        initaiteCircularBuffer(coolant[j].DataItems, timeVal, uuid);
      }
    }

    if (components[i].Hydraulic !== undefined) {
      const hydraulic = components[i].Hydraulic;
      for (let j = 0; j < hydraulic.length; j++) {
        initaiteCircularBuffer(hydraulic[j].DataItems, timeVal, uuid);
      }
    }

    if (components[i].Pneumatic !== undefined) {
      const pneumatic = components[i].Pneumatic;
      for (let j = 0; j < pneumatic.length; j++) {
        initaiteCircularBuffer(pneumatic[j].DataItems, timeVal, uuid);
      }
    }
  }
}

/**
  * parseSystems() parse the Systems in schema
  *
  * @param = {Object} systems (from schema level 5)
  * @param = {String} time (of schema reception)
  * @param = {uuid} UUID of the device
  */
function parseSystems(systems, timeVal, uuid) {
  for (let i = 0; i < systems.length; i++) {
    if (systems[i].Components !== undefined) {
      const components = systems[i].Components;
      parseSystemsComponents(components, timeVal, uuid);
    }
    if (systems[i].DataItems !== undefined) {
      initaiteCircularBuffer(systems[i].DataItems, timeVal, uuid);
    }
  }
}

/**
  * parseComponents() parse the Components in schema
  *
  * @param = {Object} components (from schema level 4)
  * @param = {String} time (of schema reception)
  * @param = {uuid} UUID of the device
  */
function parseComponents(components, timeVal, uuid) {
  for (let i = 0; i < components.length; i++) {
    if (components[i].Axes !== undefined) {
      parseAxes(components[i].Axes, timeVal, uuid);
    }
    if (components[i].Controller !== undefined) {
      parseController(components[i].Controller, timeVal, uuid);
    }
    if (components[i].Systems !== undefined) {
      parseSystems(components[i].Systems, timeVal, uuid);
    }
  }
}

/* ******************** Device Schema Collection ****************** */
/**
  * getSchemaDB() returns the deviceSchema
  * collection ptr in lokijs database
  *
  * @param = null
  */
function getSchemaDB() {
  return mtcDevices;
}


/**
  * read objects from json and insert into collection
  * @param {Object} parsedData (JSONObj)
  *
  */
function insertSchemaToDB(parsedData) {
  const parsedDevice = parsedData.MTConnectDevices;
  const devices = parsedDevice.Devices;
  const xmlns = parsedDevice.$;
  const timeVal = parsedDevice.Header[0].$.creationTime;
  const numberOfDevices = devices.length;

  const uuid = [];
  const device = [];
  const name = [];

  for (let i = 0; i < numberOfDevices; i++) {
    const devices0 = devices[i];
    const numberOfDevice = devices0.Device.length;
    for (let j = 0; j < numberOfDevice; j++) {
      device[j] = devices0.Device[j];
      name[j] = device[j].$.name;
      uuid[j] = device[j].$.uuid;
      mtcDevices.insert({ xmlns, time: timeVal, name: name[j],
      uuid: uuid[j], device: device[j] });

      // to  update dataItems in CB
      const dataItems = devices[i].Device[j].DataItems;
      if (dataItems !== undefined) {
        initaiteCircularBuffer(dataItems, timeVal, uuid[j]);
      }

      // to parse components
      const components = devices[i].Device[j].Components;
      if (components !== undefined) {
        parseComponents(components, timeVal, uuid[j]);
      }
    }
  }
}

/**
  * searchDeviceSchema() searches the device schema collection
  * for the recent entry for the  given uuid
  *
  * @param {String} uuid
  *
  * returns the latest device schema entry for that uuid
  */
function searchDeviceSchema(uuid) {
  const deviceSchemaPtr = getSchemaDB();
  const latestSchema = deviceSchemaPtr.chain()
                                      .find({ uuid })
                                      .sort('time')
                                      .data();
  return latestSchema;
}


/**
  * compareSchema() checks for duplicate entry
  * @param {object} foundFromDc - existing device schema
  * entry in database with same uuid.
  * @param {object} newObj - received schema in JSON
  * returns true if the existing schema is same as the new schema
  */
function compareSchema(foundFromDc, newObj) {
  const dcHeader = foundFromDc[0].xmlns;
  const dcTime = foundFromDc[0].time;
  const dcDevice = foundFromDc[0].device;
  const newHeader = newObj.MTConnectDevices.$;
  const newTime = newObj.MTConnectDevices.Header[0].$.creationTime;
  const newDevice = newObj.MTConnectDevices.Devices[0].Device[0];

  if (R.equals(dcHeader, newHeader)) {
    if (R.equals(dcTime, newTime)) {
      if (R.equals(dcDevice, newDevice)) {
        return true;
      } return false;
    } return false;
  } return false;
}

/**
  * updateSchemaCollection() updates the DB with newly received schema
  * after checking for duplicates
  * @param {object} schemaReceived - XML from http.get
  * returns the lokijs DB ptr
  */
function updateSchemaCollection(schemaReceived) {
  const jsonObj = xmlToJSON.xmlToJSON(schemaReceived);

  if (jsonObj !== undefined) {
    const uuid = jsonObj.MTConnectDevices.Devices[0].Device[0].$.uuid;
    const xmlSchema = getSchemaDB();
    const checkUuid = xmlSchema.chain()
                               .find({ uuid })
                               .data();  

    if (!checkUuid.length) {
      log.debug('Adding a new device schema');
      insertSchemaToDB(jsonObj);
    } else if (compareSchema(checkUuid, jsonObj)) {
      log.debug('This device schema already exist');
    } else {
      log.debug('Adding updated device schema');
      insertSchemaToDB(jsonObj);
    }
  }

  return;
}


// ******************** Raw Data Collection ******************* //

/**
  * getRawDataDB() returns the SHDR collection
  * ptr in lokijs database
  *
  * @param = null
  */
function getRawDataDB() {
  return rawData;
}


/**
  * getId() get the Id for the dataitem from the deviceSchema
  *
  * @param {String} uuid
  * @param {String} dataItemName
  *
  * return id (Eg:'dtop_2')
  */
function getId(uuid, dataItemName) {
  function isSameName(element) {
    if (element.$.name === dataItemName) {
      return true;
    }
    return false;
  }

  const findUuid = searchDeviceSchema(uuid);
  const dataItems = findUuid[0].device.DataItems[0];
  const dataItem = dataItems.DataItem;
  const index = dataItem.findIndex(isSameName);
  const id = dataItem[index].$.id;
  return id;
}

/**
  * post insert listener
  * calling function updateCircularBuffer on every insert to lokijs
  *
  *  @param obj = jsonData inserted in lokijs
  * { sequenceId: 0, id:'dtop_2', uuid:'000', time: '2',
  *    dataItemName:'avail', value: 'AVAILABLE' }
  */
rawData.on('insert', (obj) => {
  dataStorage.updateCircularBuffer(obj);
});

/**
  * dataCollectionUpdate() inserts the shdr data into the shdr collection
  *
  * @param {Object} shdrarg - with dataitem and time
  *
  */
function dataCollectionUpdate(shdrarg) {
  const dataitemno = shdrarg.dataitem.length;
  const uuid = common.getUuid();
  for (let i = 0; i < dataitemno; i++) {
    const dataItemName = shdrarg.dataitem[i].name;
    const id = getId(uuid, dataItemName);
    rawData.insert({ sequenceId: sequenceId++, id, uuid, time: shdrarg.time,
                  dataItemName, value: shdrarg.dataitem[i].value });
  }
  return;
}

/**
  * probeResponse() create json as a response to probe request
  *
  * @param {Object} latestSchema - latest device schema
  *
  * returns the JSON object with device detail.
  */

function probeResponse(latestSchema) {
  const newXMLns = latestSchema[0].xmlns;
  const newTime = moment.utc().format();
  const dvcHeader = latestSchema[0].device.$;
  const dvcDescription = latestSchema[0].device.Description;
  const dataItem = latestSchema[0].device.DataItems[0].DataItem;
  const instanceId = 0; // TODO Update the value
  let newJSON = {};

  newJSON = { MTConnectDevices: { $: newXMLns,
  Header: [{ $:
  { creationTime: newTime, assetBufferSize: '1024', sender: 'localhost', assetCount: '0',
  version: '1.3', instanceId, bufferSize: '524288' } }],
  Devices: [{ Device: [{ $:
  { name: dvcHeader.name, uuid: dvcHeader.uuid, id: dvcHeader.id },
    Description: dvcDescription,
    DataItems: [{ dataItem }],
  }] }] } };

  return newJSON;
}

// Exports

module.exports = {
  compareSchema,
  dataCollectionUpdate,
  getRawDataDB,
  getSchemaDB,
  getId,
  insertSchemaToDB,
  probeResponse,
  searchDeviceSchema,
  updateSchemaCollection,
};
