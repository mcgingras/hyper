var MIME_TYPES = ['audio/webm;codecs=opus']

function getMimeType (supportFn) {
  return MIME_TYPES.map(function (e) {
    return supportFn(e) ? e : null
  }).filter(function (e) {
    return e !== null
  })[0]
}

module.exports = getMimeType
