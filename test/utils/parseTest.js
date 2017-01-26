const assert = require('assert');
const headers = require('../support/device_headers.json');
const info = require('../support/device_info.json');
const { deviceHeaders } = require('../../src/utils');

describe('Utils', () => {
  it('parseHeaders', () => {
    assert.deepEqual(deviceHeaders(headers), info);
  });
});

