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

/** The function's source (cloudfront-js-2.0). It overrides what the origin sent and drops `Server`. */
function headersFunctionCode(securityHeaders) {
  const headers = headerValues(securityHeaders)
  return `var HEADERS = ${JSON.stringify(headers)};
function handler(event) {
  var response = event.response;
  var headers = response.headers;
  for (var name in HEADERS) headers[name] = { value: HEADERS[name] };
  delete headers['server'];
  return response;
}`
}

module.exports = { headerValues, headersFunctionCode }
