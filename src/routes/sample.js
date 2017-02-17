const { sampleImplementation, giveResponse, errResponse } = require('../utils/handlers');

function *sample() {
  let uuidCollection;
  const { device, count, from, path, frequency } = this.params;
  if (device === undefined) {
    uuidCollection = common.getAllDeviceUuids(this.devices);
  } else {
    uuidCollection = [common.getDeviceUuid(device)];
  }

  (res, call, receivedPath, device, uuidCollection, acceptType)

  // eg: reqPath = /sample?path=//Device[@name="VMC-3Axis"]//Hydraulic&from=97&count=5
  const reqPath = receivedPath;
  const count = checkAndGetParam(res, acceptType, reqPath, 'count', 100, 1);
  let from = checkAndGetParam(res, acceptType, reqPath, 'from', undefined, 1);
  let path = checkAndGetParam(res, acceptType, reqPath, 'path', undefined, 0);
  let freq = checkAndGetParam(res, acceptType, reqPath, 'frequency', undefined, 1);
  if (path !== undefined) {
    path = path.replace(/%22/g, '"');
  }

  if (!from) { // No from eg: /sample or /sample?path=//Axes
    const sequence = dataStorage.getSequence();
    from = sequence.firstSequence; // first sequenceId in CB
  }
  if (freq === undefined) {
    freq = checkAndGetParam(res, acceptType, reqPath, 'interval', undefined, 1);
  }
  if ((freq !== undefined) && (!queryError)) {
    return handleMultilineStream(res, path, uuidCollection, freq, 'sample', from, count, acceptType);
  }
  if (!queryError) {
    const obj = validityCheck('sample', uuidCollection, path, from, count);

    if (obj.valid) {
      const jsonData = sampleImplementation(res, acceptType, from, count, path, uuidCollection);
      return giveResponse(jsonData, acceptType, res);
    }
    // if obj.valid = false ERROR
    return errResponse(res, acceptType, 'validityCheck', obj.errorJSON);
  }

  handleCall(this.res, 'sample', this.req.url, this.params.device, this.headers.accept);
}

module.exports = (router) => {
  router
    .get('/sample', sample)
    .get('/:device/sample', sample);
};
