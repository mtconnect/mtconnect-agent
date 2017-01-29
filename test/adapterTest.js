require('co-mocha');
const readline = require('readline');
const http = require('http');
const assert = require('assert');
const request = require('co-request');
const fs = require('fs');
const ip = require('ip').address();
const config = require('../src/config/config');
const adapter = require('../src/simulator/adapter');
const device = require('../src/simulator/device');
const fileServer = require('../src/simulator/fileserver');
const { Client } = require('node-ssdp');
const client = new Client();
const { filePort, machinePort, inputFile } = config.app.simulator;
const { path, urnSearch } = config.app.agent;

function getLine() {
  return new Promise((success, fail) => {
    const stm = fs.createReadStream(inputFile);
    const rl = readline.createInterface({
      input: stm,
    });

    rl.on('line', function onLine(line) {
      rl.removeListener('line', onLine);
      stm.close();
      rl.close();
      success(line);
    });
    rl.on('error', (err) => {
      rl.close();
      fail(err);
    });
  });
}

describe('simulator', () => {
  let deviceT;
  let filesT;
  let lineT;

  before(function *setup() {
    adapter.start();
    lineT = yield getLine();
    yield new Promise((success) => (deviceT = device.listen(machinePort, ip, success)));
    yield new Promise((success) => (filesT = fileServer.listen(filePort, ip, success)));
  });

  after(() => {
    deviceT.close();
    filesT.close();
    adapter.stop();
  });

  describe('device', () => {
    it('streams data', (done) => {
      http.get(`http://${ip}:${machinePort}`, (res) => {
        assert(res.headers['content-type'] === 'text/event-stream; charset=utf-8');
        assert(res.statusCode === 200);
        res.on('data', (line) => {
          assert(lineT === line.toString());
          done();
        });
        res.on('end', done);
      }).on('error', done);
    });
  });

  describe('fileServer', () => {
    it('serves xml def', function *xml() {
      const res = yield request(`http://${ip}:${filePort}${path}`);
      assert(res.headers['content-type'] === 'application/xml');
    });
  });

  describe('adapter', () => {
    it('can be found via UPnP', (done) => {
      const lookup = `urn:schemas-mtconnect-org:service:${urnSearch}`;
      client.on('response', (headers) => {
        const { ST, LOCATION } = headers;
        assert(ST === lookup);
        assert(LOCATION === `${ip}:${machinePort}:${filePort}`);
        done();
      });
      client.search(lookup);
    });
  });
});
