// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// The security headers CloudFront sets with a viewer-response function
// (spec 014, D-7) are the ones of infra/security-headers.json, the same file
// vite preview applies for the layout check (spec 010, 5.13).
const require = createRequire(import.meta.url)
const { headerValues, headersFunctionCode } = require('../../infra/edge/security-headers.cjs') as {
  headerValues: (headers: unknown) => Record<string, string>
  headersFunctionCode: (headers: unknown) => string
}
const securityHeaders = JSON.parse(readFileSync(new URL('../../infra/security-headers.json', import.meta.url), 'utf8'))

// Runs the function source the way CloudFront does: a `handler(event)`.
function run(code: string, headers: Record<string, { value: string }>) {
  const handler = new Function(`${code}; return handler;`)() as (event: unknown) => { headers: Record<string, { value: string }> }
  return handler({ response: { statusCode: 200, headers } }).headers
}

describe('edge security headers', () => {
  it('sets every header of the shared policy, enforced CSP included', () => {
    const out = run(headersFunctionCode(securityHeaders), { 'content-type': { value: 'text/html' } })
    const expected = headerValues(securityHeaders)
    for (const [name, value] of Object.entries(expected)) expect(out[name]?.value).toBe(value)
    expect(Object.keys(expected)).toContain(securityHeaders.reportOnly ? 'content-security-policy-report-only' : 'content-security-policy')
    expect(out['content-type']?.value).toBe('text/html')
  })

  it('overrides what the origin sent and drops Server (ZAP 10036)', () => {
    const out = run(headersFunctionCode(securityHeaders), { server: { value: 'AmazonS3' }, 'x-frame-options': { value: 'SAMEORIGIN' } })
    expect(out.server).toBeUndefined()
    expect(out['x-frame-options']?.value).toBe('DENY')
  })

  it('carries the CSP directives of the JSON, frame-ancestors and default-src among them', () => {
    const csp = headerValues(securityHeaders)['content-security-policy'] ?? headerValues(securityHeaders)['content-security-policy-report-only']
    for (const directive of Object.keys(securityHeaders.contentSecurityPolicy)) expect(csp).toContain(directive)
    expect(csp).toContain("default-src 'self'")
  })

  it('fits the CloudFront Functions size limit (10 KB)', () => {
    expect(Buffer.byteLength(headersFunctionCode(securityHeaders))).toBeLessThan(10 * 1024)
  })
})
