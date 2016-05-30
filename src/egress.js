const loki = require('./lokijs');

function readfromDataCollection(dbobj, id_val, uuid_val ){

  var dv = dbobj.addDynamicView('sortedview');

  var filterresult = dbobj.chain()
                    .find({'uuid': uuid_val})
                    .find({'id': id_val})
                    .simplesort('sequenceid')
                    // .offset(2)
                    // .limit(2)
                    .data();
  var dataitemno = filterresult.length;
  result = filterresult[dataitemno - 1];
  //console.log(util.inspect(result, false, null));
  return result;
}

function searchdeviceschema(name, resultdeviceschema){

  var searchresult = resultdeviceschema.find({ 'name': name });
  var DataItemvar = new Array();
  var filterresult = new Array();

  newxmlns = searchresult[0].xmlns;
  newtime = searchresult[0].time;
  newuuid = searchresult[0].uuid;

  numberofdataitems = searchresult[0].device.DataItems[0].DataItem.length;

  for (var i =0; i < numberofdataitems; i++) {
    filterresult[i] = readfromDataCollection(datacollectionptr, searchresult[0].device.DataItems[0].DataItem[i].$.id, searchresult[0].device.$.uuid );
    DataItemvar[i] ={"$":{"type":searchresult[0].device.DataItems[0].DataItem[i].$.type,"category":searchresult[0].device.DataItems[0].DataItem[i].$.category,"id":searchresult[0].device.DataItems[0].DataItem[i].$.id,"name":searchresult[0].device.DataItems[0].DataItem[i].$.name},  "_":filterresult[i].value}
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
   // console.log(util.inspect(newjson, false, "NULL"));

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
}

module.exports = {
  readfromDataCollection,
  searchdeviceschema,
  jsontoxml,
};
