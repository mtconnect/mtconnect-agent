const sample = require('./sample');
const assets = require('./assets');

module.exports = (router) => {
  assets(router);
  sample(router);
};
