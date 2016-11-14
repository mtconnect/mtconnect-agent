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
const fs = require('fs');
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

describe.skip('machineDataGenerator', () => {
  it('should return simulated values', () => {
    const machineData = ad.machineDataGenerator();
    assert.equal(machineData.next().value,
    '2016-07-25T05:50:19.303002Z|avail|UNAVAILABLE');
  });
});

describe.skip('dataExists', () => {
  context('success', () => {
    it('must return data', () => {
      const machineData = ad.machineDataGenerator();
      assert.equal(ad.dataExists(machineData),
      '2016-07-25T05:50:19.303002Z|avail|UNAVAILABLE');
    });
  });

  context('ENOENT', () => {
    let save;
    let spy;

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

describe.skip('writeData', () => {
  context('on success', () => {
    const machine = net.createServer();
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
      machine.close();
    });

    it('must succeed', () => {
      client.on('data', (d) => {
        assert.equal(d, 'Hello');
      });
    });
  });

  context('on socket closed', () => {
    let save1;
    let s;
    let save;
    let spy;
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
 * writeDataLoop
 */

describe.skip('writeDataLoop', () => {
  context('on success', () => {
    let result = '';
    const machine = net.createServer();
    const client = new net.Socket();

    before(() => {
      machine.on('connection', (socket) => {
        ad.writeDataLoop(socket, 1, 0.000);
      });

      machine.listen(7879, ip.address());

      client.on('data', (d) => {
        result += d;
      });

      client.connect(7879, ip.address());
    });

    after(() => {
      client.close;
      machine.close();
    });

    it('must succeed', function (done) {
      this.timeout(10000);

      setTimeout(function () {
        expect(result).to.contain('avail');
        done();
      }, 2000);
    });
  });

  context('on failure', () => {
    let save1;
    let s;
    let save;
    let spy;

    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(Math, 'floor');

      save1 = sinon.stub(Math, 'random');
      save1.withArgs().returns(0);
      s = net.Socket();

      ad.writeDataLoop(s, 1, 0.000);
    });

    after(() => {
      s.close;

      Math.floor.restore();
      Math.random.restore();

      save.restore();
    });

    it('must return error', () => {
      expect(spy.callCount).to.be.equal(0);
    });
  });
});


/**
 * fileServer
 */

describe.skip('fileServer', () => {
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
    let save;
    let spy;
    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'error');
      ad.startFileServer(445);
    });

    after(() => {
      ad.stopFileServer();

      log.error.restore();
      save.restore();
    });

    it('must return error', () => {
      expect(spy.callCount).to.be.above(0);
    });
  });
});

/**
 * simulator
 */

describe.skip('simulator', () => {
  context('on error', () => {
    let save;
    let spy;
    const machinePort = 445;

    before(() => {
      save = sinon.stub(process, 'exit');
      spy = sinon.spy(log, 'error');
      ad.startSimulator(machinePort, ip.address());
    });

    after(() => {
      ad.stopSimulator();
      log.error.restore();
      save.restore();
    });

    it('must exit cleanly', () => {
      console.log('spy.callCount', spy.callCount);
      expect(spy.callCount).to.be.above(0);
    });
  });

  context('on connect', () => {
    before(() => {
      ad.startSimulator(7879, 'localhost');
    });

    after(() => {
      ad.stopSimulator();
    });

    it('must be successful', () => {
      testAgent(7879, 'localhost');
    });
  });
});


/**
 * SSDP
 */

describe.skip('SSDP', () => {
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
      expect(spy.callCount).to.be.above(0);
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
      expect(spy.callCount).to.be.above(0);
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
      expect(spy.callCount).to.be.above(0);
    });
  });
});


/**
 * process
 */

describe.skip('process', () => {
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
