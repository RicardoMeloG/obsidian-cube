// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// The security headers CloudFront sets with a viewer-response function
// (spec 014, D-7) are the ones of infra/security-headers.json, the same file
// vite preview applies for the layout check (spec 010, 5.13).
const require = createRequire(import.meta.url)
const { headerValues, headersFunctionCode, IMMUTABLE, REVALIDATE } = require('../../infra/edge/security-headers.cjs') as {
  headerValues: (headers: unknown) => Record<string, string>
  headersFunctionCode: (headers: unknown) => string
  IMMUTABLE: string
  REVALIDATE: string
}
const securityHeaders = JSON.parse(readFileSync(new URL('../../infra/security-headers.json', import.meta.url), 'utf8'))

// Runs the function source the way CloudFront does: a `handler(event)`.
function run(code: string, headers: Record<string, { value: string }>, uri = '/index.html', statusCode = 200) {
  const handler = new Function(`${code}; return handler;`)() as (event: unknown) => { headers: Record<string, { value: string }> }
  return handler({ request: { uri }, response: { statusCode, headers } }).headers
}

describe('edge security headers', () => {
  it('sets every header of the shared policy, enforced CSP included', () => {
    const out = run(headersFunctionCode(securityHeaders), { 'content-type': { value: 'text/html' } })
    const expected = headerValues(securityHeaders)
    for (const [name, value] of Object.entries(expected)) expect(out[name]?.value).toBe(value)
    expect(Object.keys(expected)).toContain(securityHeaders.reportOnly ? 'content-security-policy-report-only' : 'content-security-policy')
    expect(out['content-type']?.value).toBe('text/html; charset=utf-8')
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

  it('names UTF-8 on text responses without a charset, and leaves others alone (ADR 009)', () => {
    const code = headersFunctionCode(securityHeaders)
    expect(run(code, { 'content-type': { value: 'text/plain' } })['content-type']?.value).toBe('text/plain; charset=utf-8')
    expect(run(code, { 'content-type': { value: 'application/xml' } })['content-type']?.value).toBe('application/xml; charset=utf-8')
    expect(run(code, { 'content-type': { value: 'text/html; charset=utf-8' } })['content-type']?.value).toBe('text/html; charset=utf-8')
    expect(run(code, { 'content-type': { value: 'image/webp' } })['content-type']?.value).toBe('image/webp')
  })

  it('keeps hashed files a year and revalidates everything else (dt-13, M-3)', () => {
    const code = headersFunctionCode(securityHeaders)
    const cache = (uri: string, status = 200) => run(code, {}, uri, status)['cache-control']?.value
    expect(cache('/assets/index-DE9iOdKj.js')).toBe(IMMUTABLE)
    expect(cache('/assets/inter-latin-wght-normal-Dx4kXJAl.woff2', 304)).toBe(IMMUTABLE)
    expect(cache(`/content/media/${'a1'.repeat(32)}.webp`)).toBe(IMMUTABLE)
    expect(cache(`/content/media/${'a1'.repeat(32)}-thumb.webp`)).toBe(IMMUTABLE)
    for (const uri of ['/index.html', '/es/seguridad/index.html', '/content/site.es.json', '/content/media/photo.webp', '/js-flag.js', '/llms.txt', '/environments/obsidian-hall.cubeuv.webp']) {
      expect(cache(uri)).toBe(REVALIDATE)
    }
  })

  it('never lets a browser keep an error (dt-13)', () => {
    const code = headersFunctionCode(securityHeaders)
    expect(run(code, {}, '/assets/missing.js', 404)['cache-control']).toBeUndefined()
    expect(run(code, { 'cache-control': { value: 'max-age=600' } }, '/.env', 403)['cache-control']).toBeUndefined()
  })

  it('fits the CloudFront Functions size limit (10 KB)', () => {
    expect(Buffer.byteLength(headersFunctionCode(securityHeaders))).toBeLessThan(10 * 1024)
  })
})
