import { describe, expect, it } from 'vitest'
import { isAllowedHref, safeHref } from './links'

describe('allowed link targets (dp-06)', () => {
  it('accepts https, mailto, a path on this site and an anchor', () => {
    for (const href of ['https://github.com/ada', 'mailto:ada@example.com', '/es/productos', '#contact']) {
      expect(isAllowedHref(href)).toBe(true)
      expect(safeHref(href)).toBe(href)
    }
  })

  it('refuses script, data, plain http, protocol-relative and bare hosts', () => {
    for (const href of ['javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'http://example.com', '//evil.example', 'example.com', 'https://', 'mailto:nobody']) {
      expect(safeHref(href)).toBeUndefined()
    }
  })

  it('trims the target it keeps and leaves an empty one out', () => {
    expect(safeHref(' https://github.com/ada ')).toBe('https://github.com/ada')
    expect(safeHref('')).toBeUndefined()
    expect(safeHref(undefined)).toBeUndefined()
  })
})
