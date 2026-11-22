// Viewer-request function of the match log behaviour (cloudfront-js-2.0).
//
// The receiver's per-IP brake (spec 016, D-1) needs the viewer's address.
// Behind the function URL, X-Forwarded-For arrives as the client sent it,
// so it can be forged (found on 2026-11-21: ten logs with forged values all
// passed). The edge knows the address of the connection itself:
// `event.viewer.ip`. This writes it in its own header, replacing anything a
// client sent under that name, and the origin request policy forwards it.

const VIEWER_IP_HEADER = 'x-viewer-ip'

const VIEWER_IP_CODE = `function handler(event) {
  var request = event.request;
  request.headers['${VIEWER_IP_HEADER}'] = { value: event.viewer.ip };
  return request;
}`

module.exports = { VIEWER_IP_CODE, VIEWER_IP_HEADER }
