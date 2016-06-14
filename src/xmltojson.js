/**
  * fns: xmltojson, insertschematoDB
  */
const common = require('./common');
const xml2js = require('xml2js');
const loki = require('./lokijs');
const mtcdevices = loki.getschemaDB();

/**
  *xml device schema to json conversion
  */
function xmltojson(xmlobj) {
  let jsonobj;
  const parser = new xml2js.Parser({ attrkey: '$' });

  // xml to json
  parser.parseString(xmlobj, (err, result) => {
    jsonobj = result;
  });
  return jsonobj;
}

/**
  * read objects from json and insert into collection
  */
function insertschematoDB(parseddata) {
  const parsedDevice = parseddata.MTConnectDevices;
  const devices0 = parsedDevice.Devices[0];
  const xmlns = parsedDevice.$;
  const timeval = parsedDevice.Header[0].$.creationTime;
  const numberofdevices = parsedDevice.Devices.length;
  const numberofdevice = devices0.Device.length;
  const uuid = [];
  const device = [];
  const name = [];

  const devicesarr = common.fillArray(numberofdevices);
  const devicearr = common.fillArray(numberofdevice);
  devicesarr.map((j) => {
      return  devicearr.map((i) => {
        name[i] = devices0.Device[i].$.name;
        uuid[i] = devices0.Device[i].$.uuid;
        device[i] = devices0.Device[i];
        mtcdevices.insert({ xmlns, time: timeval, name: name[i],
        uuid: uuid[i], device: device[i] });
   });
  });

  // for (let j = 0; j < numberofdevices; j++) {
  //   for (let i = 0; i < numberofdevice; i++) {
  //     name[i] = devices0.Device[i].$.name;
  //     uuid[i] = devices0.Device[i].$.uuid;
  //     device[i] = devices0.Device[i];
  //     mtcdevices.insert({ xmlns, time: timeval, name: name[i],
  //     uuid: uuid[i], device: device[i] });
  //   }
  // }
  return mtcdevices;
}

module.exports = {
  xmltojson,
  insertschematoDB,
};
