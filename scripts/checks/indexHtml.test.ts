// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The content security policy allows scripts and styles only from this site
// and carries no hashes (infra/security-headers.json), so index.html must not
// gain inline code. JSON-LD is data, injected at build time, and not executed.
const html = readFileSync('index.html', 'utf8')

describe('index.html', () => {
  it('has no inline script', () => {
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)].map((match) => match[0])
    expect(inline).toEqual([])
  })

  it('has no inline style', () => {
    expect(html).not.toMatch(/<style[\s>]/)
    expect(html).not.toMatch(/\sstyle="/)
  })
})
