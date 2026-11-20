// Security headers as a CloudFront Function on viewer-response (spec 014, D-7).
// The flat-rate Free plan does not allow custom response headers policies, so
// the same headers of infra/security-headers.json (spec 010, 5.13) are set by
// a function, which the plan includes. One source still: vite preview and the
// layout check read the same JSON.

/** The header map, lower-case names, from the JSON the stack and vite share. */
function headerValues(securityHeaders) {
  const csp = Object.entries(securityHeaders.contentSecurityPolicy)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ')
  return {
    [securityHeaders.reportOnly ? 'content-security-policy-report-only' : 'content-security-policy']: csp,
    'strict-transport-security': `max-age=${securityHeaders.strictTransportSecuritySeconds}; includeSubDomains`,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': securityHeaders.referrerPolicy,
    'permissions-policy': securityHeaders.permissionsPolicy,
  }
}

/** Browser caching by path (dt-13, M-3): no response carried Cache-Control, so browsers
 *  guessed. Names with a content hash never change: a year, immutable. Everything else
 *  (pages, content documents, unhashed files) is revalidated on every visit, a cheap
 *  304 with the ETag S3 sends. Only successful answers: an error must not be kept.
 *  It sets what the browser keeps, not the edge cache, which the cache policy rules. */
const IMMUTABLE = 'public, max-age=31536000, immutable'
const REVALIDATE = 'no-cache'

/** The function's source (cloudfront-js-2.0). It overrides what the origin sent, drops `Server`,
 *  names UTF-8 on text responses S3 serves without a charset (ADR 009: llms.txt, robots.txt),
 *  and sets Cache-Control on successful answers. */
function headersFunctionCode(securityHeaders) {
  const headers = headerValues(securityHeaders)
  return `var HEADERS = ${JSON.stringify(headers)};
var IMMUTABLE = ${JSON.stringify(IMMUTABLE)};
var REVALIDATE = ${JSON.stringify(REVALIDATE)};
function cacheControl(uri) {
  if (uri.indexOf('/assets/') === 0) return IMMUTABLE;
  var media = '/content/media/';
  if (uri.indexOf(media) === 0 && /^[0-9a-f]{64}(-thumb)?[.]webp$/.test(uri.slice(media.length))) return IMMUTABLE;
  return REVALIDATE;
}
function handler(event) {
  var response = event.response;
  var headers = response.headers;
  for (var name in HEADERS) headers[name] = { value: HEADERS[name] };
  delete headers['server'];
  var type = headers['content-type'];
  if (type && /^(text\\/|application\\/(xml|json|javascript))/.test(type.value) && type.value.indexOf('charset') < 0) {
    type.value = type.value + '; charset=utf-8';
  }
  var status = response.statusCode;
  if (status === 200 || status === 304) headers['cache-control'] = { value: cacheControl(event.request.uri) };
  else delete headers['cache-control'];
  return response;
}`
}

module.exports = { headerValues, headersFunctionCode, IMMUTABLE, REVALIDATE }
