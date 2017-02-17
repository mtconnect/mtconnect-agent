const { assetImplementation } = require('../utils/handlers');
// TODO handle routes here including id parsing

function *getAsset() {
  let idsA;
  const { ids, device } = this.params;
  if (ids) {
    idsA = ids.split(';');
  }
  const { type, count, removed, target, archetypeId } = this.query;
  assetImplementation(this.res, idsA, type, Number(count), removed, (target || device), archetypeId, this.headers.accept);
}

module.exports = (router) => {
  router
    .get('assets', '/:device/assets/:ids', getAsset)
    .get('assets', '/:device/assets', getAsset)
    .get('assets', '/assets/:ids', getAsset)
    .get('/assets', getAsset);
};
