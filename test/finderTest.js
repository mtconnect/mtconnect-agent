const assert = require('assert');
const config = require('../src/config/config');
const adapter = require('../adapters/src/adapter');
const { urnSearch } = config.app.agent;
const Finder = require('../src/finder');
const query = `urn:schemas-mtconnect-org:service:${urnSearch}`;
const frequency = 1000;

describe('Finder', () => {
  let finder;

  before(function *setup() {
    finder = new Finder({ query, frequency });
    yield adapter.start();
    finder.start();
  });

  after(() => {
    adapter.stop();
    finder.stop();
  });
  it('emits an event when device is found', (done) => {
    finder.once('device', (headers) => {
      assert(headers);
      done();
    });
  });
});
