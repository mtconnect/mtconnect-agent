const assert = require('assert');
const http = require('http');
const util = require('util');
const ip = require('ip');
const chai = require('chai');
const expect = chai.expect;

var adapter = require('../src/adapter.js');
var request = require('supertest');

describe('machineDataGenerator', function() {
  it('should return simulated values', function() {
    const machineData = adapter.machineDataGenerator();

    assert.equal(machineData.next().value, '2|execution|INTERRUPTED');
  });
});


describe('fileServer', function() {
  before(function() {
    instance = adapter.fileServer.listen();

    instance.on("listening", function() {
      console.log("Started ... " + util.inspect(instance.address()));
    })
  });

  describe('/public', function() {
    it('should return 200', function(done) {
      
      request = request('http://192.168.103.24:8080');

      request
        .get('/VMC-3Axis.json')
        .expect(200, function(err, res) {
          if (res) {
            assert(res.statusCode, 200);
          } else if (err) {
            console.log('Error: ');
            console.log(util.inspect(err));
          };
          done();
        })
    })
  });
  
  after(function() {
    instance.close();
  })
});
