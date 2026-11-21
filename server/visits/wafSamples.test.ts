import { describe, expect, it } from 'vitest'
import { createWafTally, type HourObject, type WafRecord } from './wafSamples'
import { fixtureHours, forEachWafHour, redateHours, type S3Reader } from './visitSource'

const rec = (over: Partial<WafRecord>): WafRecord => ({
  t: '2026-11-21T03:10Z', m: 'GET', p: '/', c: 'CL', a: 'ALLOW', r: 'acl', g: null, w: 1, k: 'browser', n: 'Chrome', ...over,
})
const hour = (id: string, records: WafRecord[], statuses: HourObject['slices'][number]['status'][] = ['complete']): HourObject => ({
  hour: id,
  slices: statuses.map((status) => ({ rule: 'acl', status })),
  records,
})

describe('the WAF records tally (spec 020)', () => {
  const tally = createWafTally(7, '2026-11-21')
  tally.add(hour('2026-11-21T03', [
    rec({ p: '/es/seguridad' }),
    rec({ p: '/es/seguridad.html', c: 'US', w: 3 }),
    rec({ p: '/', k: 'crawler', n: 'Googlebot' }),
    rec({ p: '/assets/index-abc.js' }),
    rec({ p: '/es', k: 'owner-test', n: 'owner' }),
    rec({ p: '/.env', k: 'owner-test', n: 'owner', a: 'BLOCK' }),
    rec({ p: '/wp-admin/install.php', k: 'library', n: 'curl', c: 'SE' }),
    rec({ p: '/.git/config', a: 'BLOCK', g: 'AWS#AWSManagedRulesKnownBadInputsRuleSet#ExploitablePaths_URIPATH', c: 'DE', k: 'library', n: 'python-requests' }),
    rec({ p: '/', a: 'BLOCK', r: 'ip-rate-limit-300-5min', c: 'KR' }),
    rec({ p: '/', m: 'POST' }),
    rec({ p: '/es', m: 'HEAD' }),
    rec({ p: '/es/seguridad', a: 'COUNT', r: 'AWS-AWSManagedRulesCommonRuleSet' }),
    rec({ p: '/xmlrpc.php', m: 'POST' }),
    rec({ p: '/api/iron-bastion/partidas', m: 'POST', k: 'browser', n: 'Edge' }),
  ], ['complete', 'sampled', 'truncated']))
  tally.add(hour('2026-11-21T05', [], ['missing']))
  tally.add(hour('2026-11-01T00', [rec({})]))
  const r = tally.result()

  it('counts page views by browsers, with their weights, under the page own path', () => {
    expect(r.visits).toBe(5)
    expect(r.pages).toEqual([{ key: '/es/seguridad', visits: 4 }, { key: '/es', visits: 1 }])
    expect(r.countries).toEqual([{ key: 'US', visits: 3 }, { key: 'CL', visits: 2 }])
    expect(r.perDay[r.perDay.length - 1]).toEqual({ key: '2026-11-21', visits: 5 })
  })

  it('keeps crawlers and the owner own allowed checks apart, and ignores assets and Count-mode records', () => {
    expect(r.crawlers).toBe(1)
    expect(r.ownerTests).toBe(1)
  })

  it('counts probes: unknown paths and blocks (a blocked owner-test too), not other methods on real pages', () => {
    expect(r.probes.total).toBe(5)
    expect(r.probes.blocked).toBe(3)
    expect(r.otherPaths).toBe(2)
    expect(r.probes.rules).toEqual([
      { key: 'permitido (sin página)', visits: 2 },
      { key: 'acl', visits: 1 },
      { key: 'ExploitablePaths_URIPATH', visits: 1 },
      { key: 'ip-rate-limit-300-5min', visits: 1 },
    ])
    expect(r.probes.paths.map((p) => p.key)).toEqual(['/', '/.env', '/.git/config', '/wp-admin/install.php', '/xmlrpc.php'])
    expect(r.probes.clients).toContainEqual({ key: 'library: curl', visits: 1 })
    expect(r.probes.clients).toContainEqual({ key: 'owner-test: owner', visits: 1 })
  })

  it('describes the coverage of the range and ignores hours outside it', () => {
    expect(r.coverage).toEqual({
      hours: 2,
      missingHours: 1,
      slices: { complete: 1, sampled: 1, truncated: 1, missing: 1 },
      firstHour: '2026-11-21T03',
      lastHour: '2026-11-21T05',
    })
  })
})

describe('the WAF records sources', () => {
  it('moves the fixture so its last day is today', () => {
    const hours = fixtureHours('2026-11-21')
    expect(hours.map((h) => h.hour.slice(0, 10)).sort().reverse()[0]).toBe('2026-11-21')
    expect(hours.every((h) => h.records.every((r) => r.t.slice(0, 13) === h.hour))).toBe(true)
    expect(redateHours([], '2026-11-21')).toEqual([])
  })

  it('reads one day prefix at a time, skips an unreadable object and stops on a session error', async () => {
    const objects: Record<string, string> = {
      'samples/2026/11/20/03.json': JSON.stringify(hour('2026-11-20T03', [rec({ t: '2026-11-20T03:10Z' })])),
      'samples/2026/11/21/03.json': JSON.stringify(hour('2026-11-21T03', [rec({})])),
      'samples/2026/11/21/04.json': '{broken',
    }
    const listed: string[] = []
    const reader: S3Reader = {
      async *list(prefix) {
        listed.push(prefix)
        for (const key of Object.keys(objects)) if (key.startsWith(prefix)) yield { key, lastModified: new Date() }
      },
      async read(key) {
        return Buffer.from(objects[key])
      },
    }
    const seen: string[] = []
    const count = await forEachWafHour(reader, '', '2026-11-21', 2, (h) => seen.push(h.hour))
    expect(listed).toEqual(['samples/2026/11/20/', 'samples/2026/11/21/'])
    expect(seen).toEqual(['2026-11-20T03', '2026-11-21T03'])
    expect(count).toEqual({ read: 2, skipped: 1 })

    const expired: S3Reader = {
      async *list() {
        yield { key: 'samples/2026/11/21/03.json', lastModified: new Date() }
      },
      async read() {
        throw Object.assign(new Error('expired'), { name: 'ExpiredTokenException' })
      },
    }
    await expect(forEachWafHour(expired, '', '2026-11-21', 1, () => {})).rejects.toThrow('expired')
  })
})
