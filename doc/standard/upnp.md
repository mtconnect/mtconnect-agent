<!---
TODO: Need to get permission from UPnP Consortium to
      use standard in plain text.
-->

# UPnP v1.1

[upnp.js](#Simulator "save:")

## Simulator

A test run to demonstrate the interaction between the adapter
(simulator) and the agent.

    _"What is UPnP Technology?"

## What is UPnP Technology?

An adapter should obtain an IP address in the network

    const ip = require('ip').address();
    const readline = require('readline');
    const http = require('http');
    const assert = require('assert');
    const request = require('co-request');
    const fs = require('fs');
    const adapter = require('../src/simulator/adapter');
    const device = require('../src/simulator/device');
    const fileServer = require('../src/simulator/fileserver');
    const { Client } = require('node-ssdp');
    const client = new Client();    
    const config = require('../src/config/config');
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
        yield adapter.start();
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

Makes devices available at the network

      describe('adapter', () => {
        it('can be found via UPnP', (done) => {
          const lookup = `urn:schemas-mtconnect-org:service:${urnSearch}`;
          client.on('response', (headers) => {
            const { ST, LOCATION } = headers;
            assert(ST === lookup);
            assert(LOCATION === `${ip}:${machinePort}:${filePort}`);
            client.stop();
            done();
          });
          client.search(lookup);
        });
      });

And streams data about itself when requested.

        it('streams data', (done) => {
          const req = http.get(`http://${ip}:${machinePort}`, (res) => {
            assert.equal(res.headers['content-type'], 'text/event-stream; charset=utf-8');
            assert.equal(res.statusCode, 200);
            res.once('data', (line) => {
              assert.equal(lineT, line.toString());
              req.end();
              done();
            });
          }).on('error', done);
        });
      });

Sends deice xml definition via file server

      describe('fileServer', () => {
        it('serves xml def', function *xml() {
          const res = yield request(`http://${ip}:${filePort}${path}`);
          assert(res.headers['content-type'] === 'application/xml');
        });
      });
    });
