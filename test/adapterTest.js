const assert = require('assert');
const util = require('util');

const adapter = require('../src/adapter.js');
const supertest = require('supertest');

describe('machineDataGenerator', () => {
  it('should return simulated values', () => {
    const machineData = adapter.machineDataGenerator();
    assert.equal(machineData.next().value, '2|avail|UNAVAILABLE\r'); // TODO: check /r
  });
});


describe('fileServer', () => {
  const instance = adapter.fileServer.listen();

  before(() => {
    instance.on('listening', () => {
      console.log(`Started ... ${util.inspect(instance.address())}`);
    });
  });

  describe('/public', () => {
    it('should return 200', (done) => {
      const request = supertest('http://localhost:8080');

      request
        .get('/VMC-3Axis.json')
        .expect(200, (err, res) => {
          if (res) {
            assert(res.statusCode, 200);
          } else if (err) {
            console.log('Error: ');
            console.log(util.inspect(err));
          }
          done();
        });
    });
  });

  after(() => {
    instance.close();
  });
});
