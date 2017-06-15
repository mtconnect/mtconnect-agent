const ip = require('ip').address();
const assert = require('assert');
const config = require('../src/config/config');
const adapter = require('../src/simulator/adapter');
const request = require('co-request');
const parse = require('xml-parser');
const expect = require('expect.js');
const device = require('../src/simulator/device');
const fileServer = require('../src/simulator/fileserver');
const { filePort, machinePort } = config.app.simulator;
const { start, stop } = require('../src/agent');

describe('Agent', () => {
  let deviceT;
  let filesT;

  before(function *setup() {
    //adapter.start();
    yield start();
    yield new Promise((success) => (deviceT = device.listen(machinePort, ip, success)));
    yield new Promise((success) => (filesT = fileServer.listen(filePort, ip, success)));
  });


  after(() => {
    stop();
    deviceT.close();
    filesT.close();
  });

  it('returns error on request /bad/path/', function *(done){
    const path = '/bad/path/'
    const { body } = yield request(`http://${ip}:7000${path}`)
    
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0]
    const errorCode = child.attributes.errorCode
    const content = child.content

    expect(root.name).to.eql('MTConnectError')
    expect(errorCode).to.eql('UNSUPPORTED')
    expect(content).to.eql(`The following path is invalid: ${path}.`)
    done()
  })

  it('returns error on request /LinuxCNC/current/blah', function *(done) {
    const path = '/LinuxCNC/current/blah'
    const { body } = yield request(`http://${ip}:7000${path}`)
    
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0]
    const errorCode = child.attributes.errorCode
    const content = child.content

    expect(root.name).to.eql('MTConnectError')
    expect(errorCode).to.eql('UNSUPPORTED')
    expect(content).to.eql(`The following path is invalid: ${path}.`)
    done()
  })
});

describe('Bad device', ()=>{
  let deviceT
  let filesT
  before(function *() {
    yield start();
    yield new Promise((success) => (deviceT = device.listen(machinePort, ip, success)));
    yield new Promise((success) => (filesT = fileServer.listen(filePort, ip, success)));
  })

  after(()=> {
    stop()
    deviceT.close()
    filesT.close()
  })

  it('returns error if bad device', function *(done){
    const device = 'LinuxCN'
    const { body } = yield request(`http://${ip}:7000/${device}/probe`)
    const obj = parse(body)
    const { root } = obj
    const child = root.children[1].children[0]
    const errorCode = child.attributes.errorCode
    const content = child.content

    expect(root.name).to.eql('MTConnectError')
    expect(errorCode).to.eql('NO_DEVICE')
    expect(content).to.eql(`Could not find the device ${device}.`)
    done()
  })
})
