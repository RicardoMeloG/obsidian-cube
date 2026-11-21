// Visits and probes from the web ACL sample collector's records (spec 020).
// A record already holds no IP, no header and no query; this reduces the
// hours of a range to counts, in memory, like spec 013's log tally.

import { addDaysUTC, isAsset, pagePathOf, sortCounts, type Count, type VisitSummary } from './visitLog'

export type WafRecord = {
  t: string // ten-minute slice, `2026-11-21T03:10Z`
  m: string
  p: string
  c: string
  a: string // ALLOW, BLOCK, COUNT
  r: string // rule metric name
  g: string | null // managed rule that matched
  w: number // sampling weight
  k: 'browser' | 'crawler' | 'library' | 'empty' | 'owner-test'
  n: string
}
export type SliceStatus = 'complete' | 'sampled' | 'truncated' | 'missing'
export type HourObject = { hour: string; slices: { rule: string; status: SliceStatus }[]; records: WafRecord[] }

export type ProbeSummary = {
  total: number
  blocked: number
  paths: Count[]
  rules: Count[]
  countries: Count[]
  clients: Count[]
  perDay: Count[]
}
// Hours collected in the range, and the hours missing between the first and
// the last of them (before its first run the collector did not exist).
export type Coverage = {
  hours: number
  missingHours: number
  slices: Record<SliceStatus, number>
  firstHour: string | null
  lastHour: string | null
}
export type WafSummary = VisitSummary & { probes: ProbeSummary; coverage: Coverage; ownerTests: number }

const TOP = 20
// Endpoints the site serves besides its pages: an allowed call to them is the
// site working, not a probe (the Iron Bastion match-log receiver, spec 015).
const KNOWN_ENDPOINTS = ['/api/iron-bastion/']

// The readable name of the rule that stopped a request: the managed rule when
// there is one (`ExploitablePaths_URIPATH`), else the rule's metric name.
const ruleName = (record: WafRecord) => (record.g ? record.g.split('#').pop()! : record.r)

export type WafTally = { add(hour: HourObject): void; result(): WafSummary }

export function createWafTally(days: number, today: string): WafTally {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new RangeError(`today must match YYYY-MM-DD, got ${today}`)
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new RangeError(`days must be an integer 1..366, got ${days}`)
  const from = addDaysUTC(today, -(days - 1))

  let visits = 0
  let crawlers = 0
  let otherPaths = 0
  let ownerTests = 0
  let blocked = 0
  let probeTotal = 0
  const maps = {
    country: new Map<string, number>(),
    day: new Map<string, number>(),
    page: new Map<string, number>(),
    probePath: new Map<string, number>(),
    probeRule: new Map<string, number>(),
    probeCountry: new Map<string, number>(),
    probeClient: new Map<string, number>(),
    probeDay: new Map<string, number>(),
  }
  const bump = (map: Map<string, number>, key: string, by: number) => map.set(key, (map.get(key) ?? 0) + by)
  const slices: Record<SliceStatus, number> = { complete: 0, sampled: 0, truncated: 0, missing: 0 }
  const hoursSeen = new Set<string>()
  let firstHour: string | null = null
  let lastHour: string | null = null

  const counts = (map: Map<string, number>, top = Infinity) => sortCounts([...map].map(([key, v]) => ({ key, visits: v }))).slice(0, top)

  return {
    add(hour: HourObject): void {
      const date = hour.hour.slice(0, 10)
      if (date < from || date > today) return
      hoursSeen.add(hour.hour)
      if (lastHour === null || hour.hour > lastHour) lastHour = hour.hour
      if (firstHour === null || hour.hour < firstHour) firstHour = hour.hour
      for (const slice of hour.slices) slices[slice.status] = (slices[slice.status] ?? 0) + 1

      for (const record of hour.records) {
        const day = record.t.slice(0, 10)
        const weight = record.w > 0 ? record.w : 1
        // A rule in Count mode does not end the request: the same request is
        // also sampled under the action that did (allowed or blocked).
        if (record.a === 'COUNT') continue
        // The owner's own checks are shown apart; but the mark is public, so a
        // blocked request that carries it is still a probe (D-6).
        if (record.k === 'owner-test' && record.a === 'ALLOW') {
          ownerTests += weight
          continue
        }
        const page = record.a === 'ALLOW' ? pagePathOf(record.p) : null
        // Another method on a real page (a preflight, a form post) is neither
        // a view nor a probe.
        if (page !== null && record.m !== 'GET' && record.m !== 'HEAD') continue
        if (page !== null) {
          if (record.k === 'browser') {
            visits += weight
            bump(maps.country, record.c, weight)
            bump(maps.day, day, weight)
            bump(maps.page, page, weight)
          } else {
            crawlers += weight
          }
          continue
        }
        // An allowed asset is part of a page someone loaded, and an allowed call
        // to a known endpoint is the site at work: neither is a probe.
        if (record.a === 'ALLOW' && (isAsset(record.p) || KNOWN_ENDPOINTS.some((prefix) => record.p.startsWith(prefix)))) continue
        // Everything else is a probe: a path the site does not have, or a block.
        if (record.a === 'ALLOW') otherPaths += weight
        else blocked += weight
        probeTotal += weight
        bump(maps.probePath, record.p, weight)
        bump(maps.probeRule, record.a === 'ALLOW' ? 'permitido (sin página)' : ruleName(record), weight)
        bump(maps.probeCountry, record.c, weight)
        bump(maps.probeClient, `${record.k}: ${record.n}`, weight)
        bump(maps.probeDay, day, weight)
      }
    },
    result(): WafSummary {
      const perDay = (map: Map<string, number>) => Array.from({ length: days }, (_, i) => addDaysUTC(from, i)).map((key) => ({ key, visits: map.get(key) ?? 0 }))
      const hourMs = (id: string) => Date.parse(`${id}:00:00Z`)
      const span = firstHour && lastHour ? (hourMs(lastHour) - hourMs(firstHour)) / 3600_000 + 1 : 0
      return {
        days,
        from,
        to: today,
        visits,
        crawlers,
        otherPaths,
        countries: counts(maps.country),
        perDay: perDay(maps.day),
        pages: counts(maps.page),
        ownerTests,
        probes: {
          total: probeTotal,
          blocked,
          paths: counts(maps.probePath, TOP),
          rules: counts(maps.probeRule, TOP),
          countries: counts(maps.probeCountry, TOP),
          clients: counts(maps.probeClient, TOP),
          perDay: perDay(maps.probeDay),
        },
        coverage: { hours: hoursSeen.size, missingHours: span - hoursSeen.size, slices, firstHour, lastHour },
      }
    },
  }
}
