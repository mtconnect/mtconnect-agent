var expect = require('expect.js');
var util = require('util');
var shdrcollection = require('../src/shdrcollection');

var shdrstring2 = "2014-08-13T07:38:27.663Z|execution|UNAVAILABLE|line|UNAVAILABLE|mode|UNAVAILABLE|"+
                  "program|UNAVAILABLE|Fovr|UNAVAILABLE|Sovr|UNAVAILABLE|"+
                  "sub_prog|UNAVAILABLE|path_pos|UNAVAILABLE"
var shdrstring1 = "2014-08-11T08:32:54.028533Z|avail|AVAILABLE" // the string we get from socket
var shdrstring3 = '2016-04-12T20:27:01.0530|logic1|NORMAL||||'

var result1 = { time: '2014-08-11T08:32:54.028533Z',dataitem: [ { name: 'avail', value: 'AVAILABLE' } ] };

var result2 = { time: '2014-08-13T07:38:27.663Z',
  dataitem:
   [ { name: 'execution', value: 'UNAVAILABLE' },
     { name: 'line', value: 'UNAVAILABLE' },
     { name: 'mode', value: 'UNAVAILABLE' },
     { name: 'program', value: 'UNAVAILABLE' },
     { name: 'Fovr', value: 'UNAVAILABLE' },
     { name: 'Sovr', value: 'UNAVAILABLE' },
     { name: 'sub_prog', value: 'UNAVAILABLE' },
     { name: 'path_pos', value: 'UNAVAILABLE' } ] };

var result3 = { time: '2016-04-12T20:27:01.0530',
  dataitem: [ { name: 'logic1', value: 'NORMAL' } ] };

var result4 = { time: '2016-04-12T20:27:01.0530',
  dataitem:
   [ { name: 'mode1', value: 'AUTOMATIC' },
     { name: 'execution1', value: 'READY' },
     { name: 'program1', value: '2869' },
     { name: 'block1', value: 'O2869(60566668_NXC_002 00)' },
     { name: 'line1', value: '1' },
     { name: 'part_count1', value: '38791' },
     { name: 'jogoverride1', value: '110' },
     { name: 'rapidoverride1', value: '100' },
     { name: 'optionalstop1', value: 'OFF' },
     { name: 'blockdelete1', value: 'OFF' },
     { name: 'dryrun1', value: 'OFF' },
     { name: 'cutting1', value: 'OFF' },
     { name: 'toolnumber1', value: '77' },
     { name: 'reset1', value: 'OFF' },
     { name: 'operationmode1', value: 'MEM' },
     { name: 'axes1', value: 'X Y Z C B W Z' } ] };

dbresult1 = [ 0, 0];
dbresult2 = [ 0, 7];
dbresult3 = [ 6, 15];

describe( 'shdr parsing',  () => {

  describe( 'shdrParsing()',  () => {

    it( 'should parse shdr with single dataitem correctly', () => {
      return expect(shdrcollection.shdrParsing(shdrstring1)).to.eql(result1);
    });

    it( 'should parse shdr with multiple dataitem correctly', () => {
      return expect(shdrcollection.shdrParsing(shdrstring2)).to.eql(result2);
    });

    it( 'should parse shdr with single dataitem and empty pipes correctly', () => {
      return expect(shdrcollection.shdrParsing(shdrstring3)).to.eql(result3);
    });

  });

});

//TODO edit the test

// describe('datainsertion',  () => {
//   describe('dataCollectionUpdate()',  () => {
//
//     it('should insert single dataitem in database and update first and last sequence correctly', () => {
//       var check1 = shdrcollection.dataCollectionUpdate(result1);
//       return expect([check1.firstsequence, check1.lastsequence]).to.eql(dbresult1);
//     });
//
//     it('should insert multiple dataitem in database and update first and last sequence correctly', () => {
//       var check2 = shdrcollection.dataCollectionUpdate(result2);
//       return expect([check2.firstsequence, check2.lastsequence]).to.eql(dbresult2);
//     });
//
//     it('should insert multiple dataitem (> 10) in database and update first and last sequence correctly', () => {
//       var check3 = shdrcollection.dataCollectionUpdate(result4);
//       return expect([check3.firstsequence, check3.lastsequence]).to.eql(dbresult3);
//     });
//
//   });
// });
