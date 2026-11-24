// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  pagePathOf,
  agentOf,
  readLogLine,
  summarize,
} from './visitLog'

describe('pagePathOf', () => {
  it('maps / to /', () => {
    expect(pagePathOf('/')).toBe('/')
  })

  it('maps /index.html to /', () => {
    expect(pagePathOf('/index.html')).toBe('/')
  })

  it('maps /es.html to /es', () => {
    expect(pagePathOf('/es.html')).toBe('/es')
  })

  it('maps /es/ to /es', () => {
    expect(pagePathOf('/es/')).toBe('/es')
  })

  it('maps /es/seguridad.html to /es/seguridad', () => {
    expect(pagePathOf('/es/seguridad.html')).toBe('/es/seguridad')
  })

  it('maps /security to /security', () => {
    expect(pagePathOf('/security')).toBe('/security')
  })

  it('maps /profile.es.html to /profile.es', () => {
    expect(pagePathOf('/profile.es.html')).toBe('/profile.es')
  })

  it('counts the methodology page in both languages (spec 022)', () => {
    expect(pagePathOf('/methodology')).toBe('/methodology')
    expect(pagePathOf('/methodology.html')).toBe('/methodology')
    expect(pagePathOf('/es/metodologia/')).toBe('/es/metodologia')
  })

  it('returns null for /wp-login.php', () => {
    expect(pagePathOf('/wp-login.php')).toBeNull()
  })

  it('returns null for /assets/index-abc.js', () => {
    expect(pagePathOf('/assets/index-abc.js')).toBeNull()
  })

  it('returns null for /es/nope', () => {
    expect(pagePathOf('/es/nope')).toBeNull()
  })
})

describe('agentOf', () => {
  it('classifies desktop Chrome as human', () => {
    expect(
      agentOf(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe('human')
  })

  it('classifies URL-encoded Chrome UA as human', () => {
    expect(
      agentOf(
        'Mozilla%2F5.0%20(Windows%20NT%2010.0%3B%20Win64%3B%20x64)%20AppleWebKit%2F537.36%20(KHTML%2C%20like%20Gecko)%20Chrome%2F120.0.0.0%20Safari%2F537.36',
      ),
    ).toBe('human')
  })

  it('classifies Googlebot as crawler', () => {
    expect(
      agentOf('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    ).toBe('crawler')
  })

  it('classifies GPTBot as crawler', () => {
    expect(agentOf('GPTBot/1.0; +https://openai.com/gptbot')).toBe('crawler')
  })

  it('classifies ClaudeBot as crawler', () => {
    expect(agentOf('ClaudeBot/1.0; +https://claude.ai/bot')).toBe('crawler')
  })

  it('classifies link previews (Facebook, WhatsApp, Embedly) as crawlers', () => {
    for (const ua of [
      'facebookexternalhit/1.1%20(+http://www.facebook.com/externalhit_uatext.php)',
      'WhatsApp/2.23.20.0',
      'Mozilla/5.0%20(compatible;%20Embedly/0.2;%20+http://support.embed.ly/)',
    ]) {
      expect(agentOf(ua), ua).toBe('crawler')
    }
  })

  it('classifies - as crawler', () => {
    expect(agentOf('-')).toBe('crawler')
  })

  it('classifies curl/8.0 as crawler', () => {
    expect(agentOf('curl/8.0')).toBe('crawler')
  })
})

describe('readLogLine', () => {
  const base: Record<string, string> = {
    date: '2026-11-12',
    time: '21:34:06',
    'c-country': 'CL',
    'cs-method': 'GET',
    'cs-uri-stem': '/security',
    'sc-status': '200',
    'cs(User-Agent)': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  }

  it('ignores a POST request', () => {
    const line = JSON.stringify({ ...base, 'cs-method': 'POST' })
    expect(readLogLine(line)).toEqual({ kind: 'ignored' })
  })

  it('ignores a 404 status', () => {
    const line = JSON.stringify({ ...base, 'sc-status': '404' })
    expect(readLogLine(line)).toEqual({ kind: 'ignored' })
  })

  it('ignores an asset path', () => {
    const line = JSON.stringify({ ...base, 'cs-uri-stem': '/assets/index-abc.js' })
    expect(readLogLine(line)).toEqual({ kind: 'ignored' })
  })

  it('returns other-path for an unknown non-asset path', () => {
    const line = JSON.stringify({ ...base, 'cs-uri-stem': '/wp-login.php' })
    expect(readLogLine(line)).toEqual({ kind: 'other-path', date: '2026-11-12' })
  })

  it('returns a view for a valid page', () => {
    const line = JSON.stringify(base)
    expect(readLogLine(line)).toEqual({
      kind: 'view',
      view: { date: '2026-11-12', country: 'CL', page: '/security', agent: 'human' },
    })
  })

  it('does not leak c-ip into the result', () => {
    const line = JSON.stringify({ ...base, 'c-ip': '192.0.2.10' })
    const result = readLogLine(line)
    expect(result.kind).toBe('view')
    const json = JSON.stringify(result)
    expect(json).not.toContain('192.0.2.10')
    expect(json).not.toContain('c-ip')
  })
})

describe('summarize', () => {
  function makeLine(overrides: Record<string, string> = {}): string {
    return JSON.stringify({
      date: '2026-11-12',
      time: '21:34:06',
      'c-country': 'CL',
      'cs-method': 'GET',
      'cs-uri-stem': '/security',
      'sc-status': '200',
      'cs(User-Agent)': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      ...overrides,
    })
  }

  it('produces zero-filled perDay of length days', () => {
    const lines = [makeLine()]
    const s = summarize(lines, 7, '2026-11-12')
    expect(s.perDay).toHaveLength(7)
    expect(s.perDay[0]).toEqual({ key: '2026-11-06', visits: 0 })
    expect(s.perDay[6]).toEqual({ key: '2026-11-12', visits: 1 })
  })

  it('excludes out-of-range dates', () => {
    const lines = [
      makeLine({ date: '2026-11-01' }),
      makeLine({ date: '2026-11-12' }),
    ]
    const s = summarize(lines, 3, '2026-11-12')
    expect(s.visits).toBe(1)
  })

  it('sorts countries by visits desc then key asc', () => {
    const lines = [
      makeLine({ 'c-country': 'BR' }),
      makeLine({ 'c-country': 'BR' }),
      makeLine({ 'c-country': 'CL' }),
      makeLine({ 'c-country': 'AR' }),
    ]
    const s = summarize(lines, 1, '2026-11-12')
    expect(s.countries).toEqual([
      { key: 'BR', visits: 2 },
      { key: 'AR', visits: 1 },
      { key: 'CL', visits: 1 },
    ])
  })

  it('maps unknown country to ZZ', () => {
    const lines = [makeLine({ 'c-country': '-' })]
    const s = summarize(lines, 1, '2026-11-12')
    expect(s.countries).toEqual([{ key: 'ZZ', visits: 1 }])
  })

  it('excludes crawlers from countries, pages, and perDay', () => {
    const lines = [
      makeLine({ 'cs(User-Agent)': 'Googlebot/2.1; +http://www.google.com/bot.html' }),
      makeLine(),
    ]
    const s = summarize(lines, 1, '2026-11-12')
    expect(s.crawlers).toBe(1)
    expect(s.visits).toBe(1)
    expect(s.countries).toEqual([{ key: 'CL', visits: 1 }])
    expect(s.pages).toEqual([{ key: '/security', visits: 1 }])
    expect(s.perDay).toEqual([{ key: '2026-11-12', visits: 1 }])
  })

  it('throws RangeError for days = 0', () => {
    expect(() => summarize([], 0, '2026-11-12')).toThrow(RangeError)
  })

  it('throws RangeError for days = 400', () => {
    expect(() => summarize([], 400, '2026-11-12')).toThrow(RangeError)
  })
})
