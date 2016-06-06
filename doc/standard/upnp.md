# UPnP v1.1

[upnp.js](#Simulator "save:")

## Simulator 

A test run to demonstrate the interaction between the adapter
(simulator) and the agent.

    _"What is UPnP Technology?"

## What is UPnP Technology?

The UPnP Device Architecture (UDA) is more than just a simple
extension of the plug and play peripheral model. It is designed to
support zero-configuration, "invisible" networking, and automatic
discovery for a breadth of of device categories from a wide range of
vendors. This means a device can dynamically join a network, obtain an
IP address,

    const ip = require('ip');

    console.log(ip.address());

convey its capabilities, and learn about the presence and
capabilities of other devices. Finally, a device can leave a network
smoothly and automatically without leaving any unwanted state behind.

    const assert = require('assert');
    const util = require('util');

    const adapter = require('../src/adapter.js');
    const supertest = require('supertest');

    describe('machineDataGenerator', () => {
      it('should return simulated values', () => {
        const machineData = adapter.machineDataGenerator();

        assert.equal(machineData.next().value, '2|execution|INTERRUPTED');
      });
    });
