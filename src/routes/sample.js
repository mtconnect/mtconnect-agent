const { sampleImplementation } = require('../utils/handlers');

function *sample(next) {
  sampleImplementation(res, acceptType, from, count, path, uuidCollection)
}

function *sampleDevice(next) {
  this.body = 'sample device';
}


module.exports = (router) => {
  router.get('/sample', sample)
    .get('/:device/sample', sampleDevice);
};
