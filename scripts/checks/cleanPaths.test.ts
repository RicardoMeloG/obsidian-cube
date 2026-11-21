// @vitest-environment node
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// The viewer-request function of the default behaviour: www to the bare
// domain (dt-34) and clean paths (ADR 009).
const require = createRequire(import.meta.url)
const { CLEAN_PATHS_CODE } = require('../../infra/edge/clean-paths.cjs') as { CLEAN_PATHS_CODE: string }

type Out = { uri?: string; statusCode?: number; headers: Record<string, { value: string }> }
function run(uri: string, host = 'ricardomelog.com', querystring: Record<string, { value: string }> = {}): Out {
  const handler = new Function(`${CLEAN_PATHS_CODE}; return handler;`)() as (event: unknown) => Out
  return handler({ request: { uri, headers: { host: { value: host } }, querystring } })
}

describe('edge clean paths', () => {
  it('serves each clean path from its page', () => {
    expect(run('/').uri).toBe('/index.html')
    expect(run('//').uri).toBe('/index.html')
    expect(run('/es').uri).toBe('/es.html')
    expect(run('/es/seguridad/').uri).toBe('/es/seguridad.html')
    expect(run('/assets/index-abc.js').uri).toBe('/assets/index-abc.js')
    expect(run('/content/site.es.json').uri).toBe('/content/site.es.json')
  })

  it('redirects www to the bare domain, permanently, keeping the path', () => {
    const out = run('/es/seguridad', 'www.ricardomelog.com', { intro: { value: '0' } })
    expect(out.statusCode).toBe(301)
    expect(out.headers.location?.value).toBe('https://ricardomelog.com/es/seguridad')
    expect(run('/', 'www.ricardomelog.com').headers.location?.value).toBe('https://ricardomelog.com/')
    expect(run('/es', 'WWW.ricardomelog.com:443').headers.location?.value).toBe('https://ricardomelog.com/es')
    expect(out.headers['strict-transport-security']?.value).toMatch(/max-age=\d+/)
  })

  it('leaves the bare domain and the CloudFront domain alone', () => {
    expect(run('/es', 'd111111abcdef8.cloudfront.net').statusCode).toBeUndefined()
    expect(run('/es', 'ricardomelog.com').statusCode).toBeUndefined()
  })
})

describe('edge clean paths and the shared policy', () => {
  it('sends the HSTS of infra/security-headers.json on the www redirect', async () => {
    const { readFileSync } = await import('node:fs')
    const policy = JSON.parse(readFileSync(new URL('../../infra/security-headers.json', import.meta.url), 'utf8')) as { strictTransportSecuritySeconds: number }
    expect(run('/', 'www.ricardomelog.com').headers['strict-transport-security']?.value).toBe(`max-age=${policy.strictTransportSecuritySeconds}; includeSubDomains`)
  })
})
