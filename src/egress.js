const lokijs = require('./lokijs');
const shdrcollection = require('./shdrcollection');

const util = require ('util');
const loki = require('lokijs');
const stream = require('stream');
const fs = require ('fs');
const converter = require('converter');



function readfromDataCollection( dbobj, id_val, uuid_val, name_val ) {

  //console.log(id_val, uuid_val, name_val);
  var dv = dbobj.addDynamicView('sortedview');
  //console.log(util.inspect(dbobj, false, null));
  var filterresult = dbobj.chain()
                    .find({'uuid': uuid_val})
                    .find({'id': id_val})
                    .find({'dataitemname':name_val})
                    .simplesort('sequenceid')
                    // .offset(2)
                    // .limit(2)
                    .data();
  var dataitemno = filterresult.length;
  result = filterresult[dataitemno - 1];
  //console.log(dataitemno);
  //console.log(util.inspect(result, false, null));
  return result;
}

function searchdeviceschema(name, resultdeviceschema, datacollectionptr) {
  //console.log(util.inspect(name, false, null));
  //console.log(util.inspect(resultdeviceschema, false, null))
  var searchresult = resultdeviceschema.find({ 'name': name });
  //console.log(util.inspect(searchresult,false, null))
  var DataItemvar = [];
  var filterresult = [];
  //
  newxmlns = searchresult[0].xmlns;
  newtime = searchresult[0].time;
  newuuid = searchresult[0].uuid;
  //
  numberofdataitems = searchresult[0].device.DataItems[0].DataItem.length;
  for (var i =0; i < numberofdataitems; i++) {
    filterresult[i] = readfromDataCollection(datacollectionptr, searchresult[0].device.DataItems[0].DataItem[i].$.id, searchresult[0].device.$.uuid,searchresult[0].device.DataItems[0].DataItem[i].$.name );
    //console.log(util.inspect(filterresult, false, null))
    DataItemvar[i] ={"$":{"type":searchresult[0].device.DataItems[0].DataItem[i].$.type,"category":searchresult[0].device.DataItems[0].DataItem[i].$.category,"id":searchresult[0].device.DataItems[0].DataItem[i].$.id,"name":searchresult[0].device.DataItems[0].DataItem[i].$.name}, "_":filterresult[i].value}
  }

  var newjson = {"MTConnectDevices":{"$":newxmlns,
  "Header":[{"$":
  {"creationTime":newtime,"assetBufferSize":"1024", "sender":"localhost", "assetCount":"0","version":"1.3","instanceId":"0","bufferSize":"524288"}}],
  "Devices":[{"Device":[{"$":
  {"name":searchresult[0].device.$.name, "uuid":searchresult[0].device.$.uuid, "id":searchresult[0].device.$.id},
  "Description":searchresult[0].device.Description,
  "DataItems":[{"DataItem":DataItemvar}]
  }]}]}}

   return newjson;
  // console.log(util.inspect(newjson, false,null));

}

function jsontoxml( source, destination) {

  //reading a string and creating a stream not required when passing a file
  var s = new stream.Readable();
  s._read = function noop() {
    this.push(source);
    this.push(null);
  };

  var jsonreader = s; //fs.createReadStream(source) to pass a file
  var xmlwriter = fs.createWriteStream(destination);
  var options = {
    	from: 'json',
    	to: 'xml'
    };
  var convert = converter(options);
  jsonreader.pipe(convert).pipe(xmlwriter);
  // console.log = (msg) => {
  // process.stdout.write((jsonreader.pipe(convert)));
  // };
  return destination;
}

module.exports = {
  readfromDataCollection,
  searchdeviceschema,
  jsontoxml,
};
