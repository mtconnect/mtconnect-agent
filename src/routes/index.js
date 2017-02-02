const sample = require('./sample');
const assets = require('./assets');

module.exports = (router) => {
  sample(router);
  assets(router);
};
