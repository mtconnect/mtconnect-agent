const EventEmitter = require('events');
class MockSSDP extends EventEmitter {
  constructor() {
    super();
  }
  
  search(query) {
    if (!MockSSDP.fail) {
      this.emit('response', MockSSDP.response);
    } else {
      this.emit('error', MockSSDP.response);
    }
    return this;
  }
  
  start() { return this; }
  stop() { return this; }
};

MockSSDP.response = '';
MockSSDP.fail = false;

module.exports = {
  Client: MockSSDP,
  Server: undefined,
};
