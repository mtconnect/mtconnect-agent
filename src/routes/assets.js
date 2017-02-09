const { handleAssetReq, storeAsset } = require('../utils/handlers');
// TODO handle routes here including id parsing

function *getAsset() {
  handleAssetReq(this.res, this.url, this.headers.accept, this.params.device);
}

function *putAsset() {
  storeAsset(this.res, this.url, this.headers.accept);
}

module.exports = (router) => {
  router
    .get('assets', '/assets/:ids', getAsset)
    .get('assets', '/:device/assets/:ids', getAsset)
    .get('/assets', getAsset)
    .put('assets', '/assets/:ids', putAsset)
    .put('assets', '/:device/assets/:ids', putAsset)
    .put('/assets', putAsset)
    .post('assets', '/assets/:ids', putAsset)
    .post('assets', '/:device/assets/:ids', putAsset)
    .post('/assets', putAsset);

};
