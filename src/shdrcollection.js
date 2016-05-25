/* creates a database to store shdr value */
const shdrcollection = require("./lokijs");
var util = require ('util')
var loki = require('lokijs');

// shdr data example: 2014-08-11T08:32:54.028533Z|avail|AVAILABLE|exec|STOPPED
var shdrstring = "2014-08-13T07:38:27.663Z|execution|UNAVAILABLE|line|UNAVAILABLE|mode|UNAVAILABLE|program|UNAVAILABLE|Fovr|UNAVAILABLE|Sovr|UNAVAILABLE|sub_prog|UNAVAILABLE|path_pos|UNAVAILABLE"
//var shdrstring = "2014-08-11T08:32:54.028533Z|avail|AVAILABLE|exec|STOPPED" // the string we get from socket
//var shdrstring = "2016-04-12T20:27:01.0530|mode1|AUTOMATIC|execution1|READY|program1|2869|block1|O2869(60566668_NXC_002 00)|line1|1|part_count1|38791|jogoverride1|110|rapidoverride1|100|optionalstop1|OFF|blockdelete1|OFF|dryrun1|OFF|cutting1|OFF|toolnumber1|77|reset1|OFF|operationmode1|MEM|axes1|X Y Z C B W Z"
var shdr = shdrcollection.getDB();

//string parsing and storing dataitemname and value from shdr
function shdrparsing(shdrstring){
  var shdrparse = shdrstring.split('|');
  var time = shdrparse[0];
  var dataitemno = (shdrparse.length - 1)/ 2;
  var dataitem = new Array();

  for (var i =0, j =1; i < dataitemno; i++, j+=2){
    if(shdrparse[j] !== '' ){ // to getrid of edge conditions eg: 2016-04-12T20:27:01.0530|logic1|NORMAL||||
        dataitem[i] = { name: shdrparse[j], value: shdrparse[j+1] }
    }
  }
  return shdrdata = { time: time, dataitem: dataitem } ;
}

//inserting shdr data into data collection
function datacollectionupdate( shdrarg ) {
  var sequenceid = "sequenceid"; // sequenceid should be updated
  var uuid = "uuid"; // the corresponding uuid
  var dataitemno = shdrarg.dataitem.length
  for (var i =0; i < dataitemno; i++){
  shdr.insert({sequenceid: sequenceid, uuid: uuid, time:shdrarg.time, dataitemname: shdrarg.dataitem[i].name, value: shdrarg.dataitem[i].value})
  //console.log(shdrarg.dataitem)
  // console.log(util.inspect(shdr, false, null));
  }
  return shdr;
}
var parseddata = shdrparsing(shdrstring);
datacollectionupdate(parseddata);
