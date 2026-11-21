import { describe, it, expect } from 'vitest'
import { sanitizeRichText } from './sanitizeRichText'

describe('sanitizeRichText', () => {
  it('strips <script> tags entirely', () => {
    const out = sanitizeRichText('hola <script>alert(1)</script> mundo')
    expect(out).not.toContain('<script>')
    expect(out).not.toContain('alert(1)')
    expect(out).toContain('hola')
    expect(out).toContain('mundo')
  })

  it('removes non-whitelisted tags with event handlers (img/onerror)', () => {
    const out = sanitizeRichText('<img src=x onerror=alert(1)>texto')
    expect(out).not.toContain('<img')
    expect(out).not.toContain('onerror')
    expect(out).toContain('texto')
  })

  it('drops javascript: hrefs on anchors', () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('click')
  })

  it('keeps whitelisted inline tags', () => {
    const out = sanitizeRichText('un <strong>énfasis</strong> y <em>cursiva</em>')
    expect(out).toContain('<strong>énfasis</strong>')
    expect(out).toContain('<em>cursiva</em>')
  })

  it('keeps safe external links and forces rel=noopener on target=_blank', () => {
    const out = sanitizeRichText('<a href="https://x.com" target="_blank">x</a>')
    expect(out).toContain('href="https://x.com"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('keeps only the link schemes of the rest of the content (dp-06)', () => {
    for (const href of ['http://x.com', 'ftp://x.com/f', 'tel:+56900000000', '//evil.example/x']) {
      const out = sanitizeRichText(`<a href="${href}">x</a>`)
      expect(out, href).not.toContain('href=')
      expect(out).toContain('x')
    }
    expect(sanitizeRichText('<a href="mailto:a@example.com">m</a>')).toContain('href="mailto:a@example.com"')
    expect(sanitizeRichText('<a href="/es/seguridad">s</a>')).toContain('href="/es/seguridad"')
  })

  it('returns plain text unchanged', () => {
    const input = 'texto plano sin etiquetas'
    expect(sanitizeRichText(input)).toBe(input)
  })
})
