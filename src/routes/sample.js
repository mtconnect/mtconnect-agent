function *sample(next) {
  this.body = 'sample';
}

function *sampleDevice(next) {
  this.body = 'sample device';
}


module.exports = (router) => {
  router.get('/sample', sample)
    .get('/:device/sample', sampleDevice);
};
