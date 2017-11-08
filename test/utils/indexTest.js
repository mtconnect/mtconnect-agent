const assert = require('assert');
const ip = require('ip').address();
const fs = require('co-fs');
const config = require('../../src/config/config');
const { path } = config.app.agent;
const fileServer = require('../../adapters/src/fileserver');
const headers = require('../support/device_headers.json');
const info = require('../support/device_info.json');
const { parseHeaders, deviceXML } = require('../../src/utils');

describe('Utils', () => {
  /*
  it('parseHeaders', () => {
    assert.deepEqual(parseHeaders(headers), info);
  });

  describe('file ops', () => {
    let server;

    before(function *setup() {
      yield new Promise((success) => (server = fileServer.listen(8080, ip, success)));
    });

    after(() => {
      server.close();
    });

    it('deviceXML', function *deviceXMLTest() {
      const res = yield deviceXML({ 8080, ip, path });
      const xml = yield fs.readFile(`./public/${path}`);
      assert(res === xml.toString());
    });
  }); */
});

