// Viewer-request function of the site's default behaviour (cloudfront-js-2.0).
//
// One host (dt-34): `www.` answers a permanent redirect to the bare domain,
// so search engines see one site; the canonical already names the bare one.
// The query is not carried: the site reads none, and copying it would need
// its exact encoding.
//
// Clean paths (ADR 009): a path with no extension is served from its page,
// `/es/seguridad` from `es/seguridad.html` and `/es` from `es.html`, so each
// address gets its own language, title and share preview. A trailing slash is
// dropped first. The root becomes `/index.html` here, not by the default root
// object: since S3 grants CloudFront s3:ListBucket (AD-09), a bare `/`
// reaching the origin would be a bucket listing, so no path (`//` included)
// may arrive as `/`.

const CLEAN_PATHS_CODE = `function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value : '';
  if (host.indexOf('www.') === 0) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: 'https://' + host.slice(4) + request.uri } },
    };
  }
  // Empty segments out: '//' and a trailing slash collapse.
  var uri = '/' + request.uri.split('/').filter(function (part) { return part !== ''; }).join('/');
  if (uri === '/') uri = '/index.html';
  else if (uri.lastIndexOf('.') <= uri.lastIndexOf('/')) uri = uri + '.html';
  request.uri = uri;
  return request;
}`

module.exports = { CLEAN_PATHS_CODE }
