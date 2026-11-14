// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readLogLine, summarize } from './visitLog'

function line(stem: string): string {
  return JSON.stringify({
    'cs-method': 'GET',
    'sc-status': '200',
    'cs-uri-stem': stem,
    date: '2025-06-15',
    'c-country': 'US',
    'cs(User-Agent)': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  })
}

describe('asset / other-path classification', () => {
  it('treats /xmlrpc.php as other-path', () => {
    const r = readLogLine(line('/xmlrpc.php'))
    expect(r).toEqual({ kind: 'other-path', date: '2025-06-15' })
  })

  it('treats /.env as other-path', () => {
    const r = readLogLine(line('/.env'))
    expect(r).toEqual({ kind: 'other-path', date: '2025-06-15' })
  })

  it('treats /cgi-bin/x as other-path', () => {
    const r = readLogLine(line('/cgi-bin/x'))
    expect(r).toEqual({ kind: 'other-path', date: '2025-06-15' })
  })

  it('ignores /robots.txt as an asset', () => {
    expect(readLogLine(line('/robots.txt'))).toEqual({ kind: 'ignored' })
  })

  it('ignores /favicon.svg as an asset', () => {
    expect(readLogLine(line('/favicon.svg'))).toEqual({ kind: 'ignored' })
  })

  it('ignores /assets/a.JS as an asset (case-insensitive extension)', () => {
    expect(readLogLine(line('/assets/a.JS'))).toEqual({ kind: 'ignored' })
  })

  it('counts /llms.txt as a view', () => {
    const r = readLogLine(line('/llms.txt'))
    expect(r.kind).toBe('view')
    if (r.kind === 'view') {
      expect(r.view.page).toBe('/llms.txt')
    }
  })
})

describe('summarize today validation', () => {
  it('throws RangeError when today is "2026-13"', () => {
    expect(() => summarize([], 7, '2026-13')).toThrow(RangeError)
  })
})
