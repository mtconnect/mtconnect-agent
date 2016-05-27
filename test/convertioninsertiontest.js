var expect = require('expect.js');
var util = require('util');
var fs = require('fs');
var xmltojson = require('../src/xmltojson');
var expectedjson = require('./samplejsonoutput');
var xml1 = fs.readFileSync('E:/specimpl/readermodule/Devices2di.xml','utf8');


describe ('xml to json conversion', function(){
  describe('xmltojson()', function(){

      it('should convert xml with 2 dataitem correctly', function(){
        var check1 = xmltojson.xmltojson(xml1);
        expect(check1).to.eql(expectedjson);
      });

  });
});
