const { assetImplementation } = require('../utils/handlers');

function *asset() {
  const assetList = this.params.id.split(';');
  const { type, count, removed, target, archetypeId } = this.query;
  assetImplementation(
    this.res,
    assetList,
    type,
    count,
    removed,
    target,
    archetypeId,
    this.req.headers.accept
  );
}

function *assets() {
  const { type, count, removed, target, archetypeId } = this.query;
  assetImplementation(
    this.res,
    undefined,
    type,
    count,
    removed,
    target,
    archetypeId,
    this.req.headers.accept
  );
}


module.exports = (router) => {
  router.get('/asset/:id', asset)
    .get('/assets', assets);
};
