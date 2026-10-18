// @vitest-environment node
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { noFraming } from './noFraming'

describe('the admin refuses every frame (audit-4 F-1)', () => {
  it('sets both headers, the old one and the content security policy', () => {
    const headers: Record<string, string> = {}
    let passed = false
    noFraming({}, { setHeader: (name, value) => (headers[name] = value) }, () => (passed = true))
    expect(headers).toEqual({ 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "frame-ancestors 'none'" })
    expect(passed).toBe(true)
  })

  it('is installed on every response, before the session and any route', () => {
    const main = readFileSync(path.join(__dirname, 'main.ts'), 'utf8')
    const installed = main.search(/app\.use\(noFraming\)/)
    const session = main.search(/app\.use\(\s*session\(/)
    expect(installed).toBeGreaterThan(-1)
    expect(session).toBeGreaterThan(installed)
  })
})
