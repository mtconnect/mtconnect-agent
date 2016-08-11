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

    const ip = require('ip');

    console.log(ip.address());

and send its values when requested.

    const assert = require('assert');
    const util = require('util');

    const adapter = require('../src/adapter.js');
    const supertest = require('supertest');

    describe('machineDataGenerator', () => {
      it('should return simulated values', () => {
        const machineData = adapter.machineDataGenerator();

        assert.equal(machineData.next().value, '2|avail|UNAVAILABLE');
      });
    });
