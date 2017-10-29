 /* global describe, it, context */
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

const assert = require('assert')

const expect = require('expect.js')

// Imports - Internal
const dataStorage = require('../src/dataStorage')
const config = require('../src/config/config')
const simulatorConfig = require('../adapters/simulator/config/config')

describe('simulatorConfig', () => {
  context('for uuid', () => {
    it('should return 43444e50-a578-11e7-a3dd-28cfe91a82ef', () => {
      assert.equal('43444e50-a578-11e7-a3dd-28cfe91a82ef', simulatorConfig.uuid)
    })
  })

  context('for machinePort', () => {
    it('should return 7879', () => {
      assert.equal(7879, simulatorConfig.machinePort)
    })
  })

  context('for filePort', () => {
    it('should return 8080', () => {
      assert.equal(8080, simulatorConfig.filePort)
    })
  })

  context('for maxDelay', () => {
    it('should return 3000', () => {
      assert.equal(3000, simulatorConfig.maxDelay)
    })
  })
})

describe('agentConfig', () => {
  context('for deviceSearchInterval', () => {
    it('should return 10000', () => {
      assert.equal(10000, config.app.agent.deviceSearchInterval)
    })
  })

  context('for agentPort', () => {
    it('should return 7000', () => {
      assert.equal(7000, config.app.agent.agentPort)
    })
  })

  context('for bufferSize', () => {
    it(`should return ${config.app.agent.bufferSize}`, () => {
      assert.equal(config.app.agent.bufferSize, dataStorage.bufferSize)
    })
  })
})

describe.skip('getConfigVal', () => {
  it('gets the configured value for the given parameter of the specified device', () => {
    const time = config.getConfiguredVal('VMC-3Axis', 'IgnoreTimestamps')
    expect(time).to.eql(false)

    const conv = config.getConfiguredVal('VMC-3Axis', 'ConversionRequired')
    expect(conv).to.eql(true)

    const conv1 = config.getConfiguredVal('VMC-5Axis', 'ConversionRequired')
    expect(conv1).to.eql(undefined)
  })
})
