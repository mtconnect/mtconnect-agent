const sample = require('./sample');
const assets = require('./assets');
const current = require('./current');

module.exports = (router) => {
  assets(router);
  sample(router);
  current(router);
};
