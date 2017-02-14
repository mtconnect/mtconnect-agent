const { storeAsset, assetImplementation } = require('../utils/handlers');
// TODO handle routes here including id parsing

function *getAsset() {
  // handleAssetReq(this.res, this.req.url, this.headers.accept, this.params.device);
  // console.log(['getasset', this.query, this.params]);
  // const type = checkAndGetParam(res, acceptType, reqPath, 'type', undefined, 0);
  // const count = checkAndGetParam(res, acceptType, reqPath, 'count', undefined, 0);
  // const removed = checkAndGetParam(res, acceptType, reqPath, 'removed', false, 0);
  // const target = checkAndGetParam(res, acceptType, reqPath, 'target', deviceName, 0);
  // const archetypeId = checkAndGetParam(res, acceptType, reqPath, 'archetypeId', undefined, 0);
  let idsA;
  const { ids, device } = this.params;
  if (ids) {
    idsA = ids.split(';');
  }
  const { type, count, removed, target, archetypeId } = this.query;
  assetImplementation(this.res, idsA, type, Number(count), removed, (target || device), archetypeId, this.headers.accept);
}

function *putAsset() {
  storeAsset(this.res, this.url, this.headers.accept);
}

module.exports = (router) => {
  router
    .get('assets', '/:device/assets/:ids', getAsset)
    .get('assets', '/:device/assets', getAsset)
    .get('assets', '/assets/:ids', getAsset)    
    .get('/assets', getAsset)
    // .put('assets', '/assets/:ids', putAsset)
    // .put('assets', '/:device/assets/:ids', putAsset)
    // .put('/assets', putAsset)
    // .post('assets', '/assets/:ids', putAsset)
    // .post('assets', '/:device/assets/:ids', putAsset)
    // .post('/assets', putAsset);
};
