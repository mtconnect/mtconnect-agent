const { handleCall } = require('../utils/handlers');

function *sample() {
  handleCall(this.res, 'sample', this.req.url, this.params.device, this.headers.accept);
}

module.exports = (router) => {
  router
    .get('/sample', sample)
    .get('/:device/sample', sample);
};
