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
const ad = require('../src/adapter.js');
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

/**
 * dataExists
 */

describe('machineDataGenerator', () => {
  it('should return simulated values', () => {
    const machineData = ad.machineDataGenerator();
    assert.equal(machineData.next().value, '2|avail|UNAVAILABLE'); // TODO: check /r
  });
});

describe('dataExists', () => {
  context('success', () => {
    it('must return data', () => {
      const machineData = ad.machineDataGenerator();

      assert.equal(ad.dataExists(machineData), '2|avail|UNAVAILABLE');
    });
  });

  context('ENOENT', () => {
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

      save.yields(ad.dataExists(machineData));
      expect(spy.callCount).to.be.equal(1);
    });
  });

  context('else error', () => {
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

      save.yields(ad.dataExists(mData));
      expect(spy.callCount).to.be.equal(1);
    });
  });
});

/**
 * writeData
 */

describe('writeData', () => {
  context('on success', () => {
    let machine = net.createServer();
    const client = new net.Socket();

    before(() => {
      machine.on('connection', (socket) => {
        const machineData = machineOneDataGenerator();

        ad.writeData(socket, machineData, 0);
      });

      machine.listen(7879, ip.address());

      client.connect(7879, ip.address());
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

  context('no data', () => {
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

      save.yields(ad.writeData(socket, machineData, 0));
      expect(stub.callCount).to.be.equal(1);
    });
  });

  context('on socket closed', () => {
    let save1, s, save, spy;
    const machineData = ad.machineDataGenerator();

    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(Math, 'floor');

      save1 = sinon.stub(Math, 'random');
      save1.withArgs().returns(0);
      s = net.Socket();

      ad.writeData(s, machineData, 0);
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
  context('/public', () => {
    before(() => {
      ad.startFileServer(8080);
    });

    after(() => {
      ad.stopFileServer();
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

  context('error', () => {
    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'error');

      ad.startFileServer(22);
    });

    after(() => {
      ad.stopFileServer();

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
  context('on error', () => {
    let save, spy;
    let file_port = 8080;
    let machine_port = 7879;

    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'error');

      ad.startSimulator(machine_port, ip.address());
    });

    after(() => {
      log.error.restore();
      save.restore();
    });

    it('must exit', () => {
      expect(spy.callCount).to.be.equal(1);
    });
  });

  context('on connect', () => {
    let save;
    let spy;

    before(() => {
      ad.startSimulator(7879, 'localhost');
    });

    after(() => {
      ad.stopSimulator();
    });

    it('must succeed', () => {
      testAgent(7879, 'localhost');
    });
  });
});

/**
 * SSDP
 */

describe('SSDP', () => {
  context('advertise-alive', () => {
    let save, spy;

    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'debug');

      ad.adapter.emit('advertise-alive');
    });

    after(() => {
      log.debug.restore();
      save.restore();
    });

    it('must log with debug', () => {
      expect(spy.callCount).to.be.equal(1);
    });
  });

  context('advertise-bye', () => {
    let save, spy;

    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'debug');

      ad.adapter.emit('advertise-bye');
    });

    after(() => {
      log.debug.restore();
      save.restore();
    });

    it('must log with debug', () => {
      expect(spy.callCount).to.be.equal(1);
    });
  });

  context('error', () => {
    let save, spy;

    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'error');

      ad.adapter.emit('error');
    });

    after(() => {
      log.error.restore();
      save.restore();
    });

    it('must throw error', () => {
      expect(spy.callCount).to.be.equal(1);
    });
  });
});


/**
 * process
 */

describe('process', () => {
  context('uncaughtException', () => {
    let save;

    before(() => {
      save = sinon.stub(process, 'on').withArgs('uncaughtException');
    });

    after(() => {
      process.on.restore();
    });

    it('must throw and log', () => {
      try {
        save.yields(process.emit('uncaughtException', new Error('Bar!')));
      } catch (e) {}
    });
  });

  context.skip('exit', () => {
    let save, spy;

    before(() => {
      save = sinon.stub(process, 'on').withArgs('exit');
      spy = sinon.spy(log, 'info');
    });

    after(() => {
      log.info.restore();
      process.on.restore();
    });

    it('must exit', () => {
      save(process.emit('exit'));
      expect(spy.callCount).to.be.equal(2);
    });
  });
});
