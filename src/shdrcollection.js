/* creates a database to store shdr value */
const loki = require('./lokijs');
const util = require ('util');
const LRUMap = require('collections/lru-map');
const fs = require('fs');
const buffersize =10; // TO DO: change it to the required buffer size
  var sequenceid = 0; // sequenceid should be updated
/* Example inputs */
// shdr data example: 2014-08-11T08:32:54.028533Z|avail|AVAILABLE|exec|STOPPED

//var shdrstring = '2014-08-13T07:38:27.663Z|execution|UNAVAILABLE|line|UNAVAILABLE|mode|UNAVAILABLE|program|UNAVAILABLE|Fovr|UNAVAILABLE|Sovr|UNAVAILABLE|sub_prog|UNAVAILABLE|path_pos|UNAVAILABLE'
//var shdrstring = '2014-08-11T08:32:54.028533Z|avail|AVAILABLE|exec|STOPPED' // the string we get from socket
//var shdrstring = '2016-04-12T20:27:01.0530|mode1|AUTOMATIC|execution1|READY|program1|2869|block1|O2869(60566668_NXC_002 00)|line1|1|part_count1|38791|jogoverride1|110|rapidoverride1|100|optionalstop1|OFF|blockdelete1|OFF|dryrun1|OFF|cutting1|OFF|toolnumber1|77|reset1|OFF|operationmode1|MEM|axes1|X Y Z C B W Z'
//var shdrstring = '2016-04-12T20:27:01.0530|logic1|NORMAL||||' ;
//var shdrstring = fs.readFileSync('../public/simple_scenario_1.txt','utf8');
var shdr = loki.getshdrDB();
var shdrmap = new LRUMap({},buffersize);

//string parsing and storing dataitemname and value from shdr
function shdrparsing(shdrstring) {

    var shdrparse = shdrstring.split('|');
    var time = shdrparse[0];
    var totaldataitem = (shdrparse.length - 1)/ 2;
    var dataitem = [];

    for (var i =0, j =1; i < totaldataitem; i++, j+=2){
      if(shdrparse[j] !== '' ){ // to getrid of edge conditions eg: 2016-04-12T20:27:01.0530|logic1|NORMAL||||
        //  dataitem[i] = { name: shdrparse[j], value: shdrparse[j+1] };
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
  console.log(shdrmap.toObject(), firstsequence, lastsequence);
});

//inserting shdr data into data collection
function datacollectionupdate( shdrarg ) {
    var uuid = 'uuid'; // the corresponding uuid
    var dataitemno = shdrarg.dataitem.length;
    for (var i =0; i < dataitemno; i++){
    shdr.insert( {sequenceid: sequenceid++, uuid: uuid, time: shdrarg.time, dataitemname: shdrarg.dataitem[i].name, value: shdrarg.dataitem[i].value} );
    //console.log(shdrarg.dataitem)
    // console.log(util.inspect(shdr, false, null));
    }
    return obj = {
    shdr,
    firstsequence,
    lastsequence,
    shdrmap: shdrmap.toObject(),
    };

}

 //var parseddata = shdrparsing(shdrstring);
 //var inserteddata = datacollectionupdate(parseddata);
// console.log(util.inspect(parseddata,false,null ));
// //console.log([inserteddata.firstsequence, inserteddata.lastsequence]);
 //console.log(shdrmap.toObject(), firstsequence, lastsequence);
//console.log(parseddata)
module.exports = {
  shdrparsing,
  datacollectionupdate,
};
