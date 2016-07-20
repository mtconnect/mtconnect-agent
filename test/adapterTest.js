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

// Imports - External

const assert = require('assert');
const util = require('util');
const chai = require('chai');
const fs = require('fs');
const http = require('http');
const net = require('net');
const ip = require('ip');

const expect = require('expect.js');
const sinon = require('sinon');

// Imports - Internal

const log = require('../src/config/logger');
const adapter = require('../src/adapter.js');
const supertest = require('supertest');

// Helper functions

function* machineNoFileGenerator() {
  const inputFile = '/tmp/FileDoesNotExist';
  const data = fs.readFileSync(inputFile).toString().split(/['\n','\r']+/);
  yield* data[Symbol.iterator]();
}

function* machineNoDataGenerator() {
  const data = [];
  yield* data[Symbol.iterator]();
}

function* machineOneDataGenerator() {
  const data = ['Hello'];
  yield* data[Symbol.iterator]();
}

function testAgent(port, address) {
  const client = new net.Socket();

  client.connect(port, address, () => {
  });

  client.on('data', (d) => {
    log.debug(`${d}`);
  });
}

// Tests

describe('machineDataGenerator', () => {
  it('should return simulated values', () => {
    const machineData = adapter.machineDataGenerator();
    assert.equal(machineData.next().value, '2|avail|UNAVAILABLE'); // TODO: check /r
  });
});

describe('dataExists', () => {
  describe('success', () => {
    it('must return data', () => {
      const machineData = adapter.machineDataGenerator();

      assert.equal(adapter.dataExists(machineData), '2|avail|UNAVAILABLE');
    });
  });

  describe('ENOENT', () => {
    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'error');
    });

    after(() => {
      save.restore();
      log.error.restore();
    });

    it('must return \'Input file not found\'', () => {
      const machineData = machineNoFileGenerator();

      save.yields(adapter.dataExists(machineData));
      expect(spy.callCount).to.be.equal(1);
    });
  });

  describe('else error', () => {
    let save;
    let spy;

    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'error');
    });

    after(() => {
      log.error.restore();
      save.restore();
    });

    it('must return error', () => {
      const mData = null;

      save.yields(adapter.dataExists(mData));
      expect(spy.callCount).to.be.equal(1);
    });
  });
});

/**
 * writeData
 */

describe('writeData', () => {
  describe('on success', () => {
    let machine = net.createServer();
    const client = new net.Socket();

    before(() => {
      machine.on('connection', (socket) => {
        const machineData = machineOneDataGenerator();

        adapter.writeData(socket, machineData, 0);
      });

      machine.listen(7878, ip.address());

      client.connect(7878, ip.address());
    });

    after(() => {
      client.close;
      machine.close;
    });

    it('must succeed', () => {
      client.on('data', (d) => {
        assert.equal(d, "Hello");
      });
    });
  });

  describe('no data', () => {
    let save, stub, socket;

    before(() => {
      save = sinon.stub(process, 'exit');

      socket = new net.Socket();
      stub = sinon.stub(socket, 'destroy')
    });

    after(() => {
      socket.destroy.restore();
      save.restore();
    });

    it('must destroy socket', () => {
      const machineData = machineNoDataGenerator();

      save.yields(adapter.writeData(socket, machineData, 0));
      expect(stub.callCount).to.be.equal(1);
    });
  });

  describe('on socket closed', () => {
    let save1, s, save, spy;
    const machineData = adapter.machineDataGenerator();

    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(Math, 'floor');

      save1 = sinon.stub(Math, 'random');
      save1.withArgs().returns(0);
      s = net.Socket();

      adapter.writeData(s, machineData, 0);
    });

    after(() => {
      s.close;

      Math.floor.restore();
      Math.random.restore();

      save.restore();
    });

    it('must return error', () => {
      expect(spy.callCount).to.be.equal(1);
    });
  });
});

/**
 * fileServer
 */

describe('fileServer', () => {
  describe('/public', () => {
    before(() => {
      adapter.startFileServer(8080);
    });

    after(() => {
      adapter.stopFileServer();
    });

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

  describe('error', () => {
    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'error');

      adapter.startFileServer(22);
    });

    after(() => {
      adapter.stopFileServer();

      log.error.restore();
      save.restore();
    });

    it('must return error', () => {
      expect(spy.callCount).to.be.equal(1);
    });
  });
});

/**
 * simulator
 */

describe('simulator', () => {
  describe('on error', () => {
    let save, spy;
    let file_port = 8080;
    let machine_port = 7878;

    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'error');

      adapter.startSimulator(machine_port, ip.address());
    });

    after(() => {
      log.error.restore();
      save.restore();
    });

    it('must exit', () => {
      expect(spy.callCount).to.be.equal(1);
    });
  });

  describe('on connect', () => {
    let save;
    let spy;

    before(() => {
      adapter.startSimulator('localhost', 7878);
    });

    after(() => {
      adapter.stopSimulator();
    });

    it('must succeed', () => {
      testAgent('localhost', 7878);
    });
  });
});
