// Counts human and crawler page views from CloudFront access logs.
// Only the whitelisted keys are read; no IP or other PII is ever copied.

import { pagePath, readPagePath } from '../../src/kernel/sitePaths'

export type Agent = 'human' | 'crawler'
export type PageView = { date: string; country: string; page: string; agent: Agent }
export type LineResult =
  | { kind: 'view'; view: PageView }
  | { kind: 'other-path'; date: string }
  | { kind: 'ignored' }

const MACHINE_PAGES: ReadonlySet<string> = new Set(['/llms.txt', '/profile', '/profile.es'])
const ASSET_PREFIXES: readonly string[] = ['/assets/', '/content/', '/environments/', '/examples/']
const ASSET_EXTENSIONS: readonly string[] = [
  '.js', '.mjs', '.css', '.map', '.svg', '.png', '.jpg', '.jpeg',
  '.webp', '.gif', '.ico', '.avif', '.woff', '.woff2', '.ttf',
  '.json', '.xml', '.txt', '.webmanifest',
]
const CRAWLER_RE =
  /bot|crawl|spider|slurp|fetch|scrape|preview|curl|wget|python|httpx|go-http|java\/|okhttp|axios|node-fetch|headless|lighthouse|monitor|uptime|scan|archive|facebookexternalhit|whatsapp|embedly/i

export function pagePathOf(stem: string): string | null {
  let path: string
  try {
    path = decodeURIComponent(stem)
  } catch {
    return null
  }
  if (path.endsWith('.html')) {
    path = path.slice(0, -5)
  }
  if (path === '/index') {
    path = '/'
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }
  if (MACHINE_PAGES.has(path)) return path
  // Counted under the page's own path: `//security`, `/%2Fsecurity` and
  // `/security//` name the same page and must not fill the list with variants.
  const page = readPagePath(path)
  if (page !== null) return page.locale === null ? '/' : pagePath({ locale: page.locale, face: page.face })
  return null
}

export function agentOf(userAgent: string): Agent {
  let ua: string
  try {
    ua = decodeURIComponent(userAgent)
  } catch {
    ua = userAgent
  }
  if (ua === '' || ua === '-') return 'crawler'
  if (CRAWLER_RE.test(ua)) return 'crawler'
  return 'human'
}

export function isAsset(path: string): boolean {
  if (ASSET_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
  if (path === '/llms.txt') return false
  const lastSlash = path.lastIndexOf('/')
  const lastSegment = path.slice(lastSlash + 1).toLowerCase()
  return ASSET_EXTENSIONS.some((ext) => lastSegment.endsWith(ext))
}

export function readLogLine(line: string): LineResult {
  const trimmed = line.trim()
  if (trimmed === '') return { kind: 'ignored' }

  let obj: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { kind: 'ignored' }
    }
    obj = parsed as Record<string, unknown>
  } catch {
    return { kind: 'ignored' }
  }

  const method = typeof obj['cs-method'] === 'string' ? obj['cs-method'] : ''
  const status = typeof obj['sc-status'] === 'string' ? obj['sc-status'] : ''
  const stem = typeof obj['cs-uri-stem'] === 'string' ? obj['cs-uri-stem'] : ''
  const date = typeof obj['date'] === 'string' ? obj['date'] : ''
  const country = typeof obj['c-country'] === 'string' ? obj['c-country'] : ''
  const ua = typeof obj['cs(User-Agent)'] === 'string' ? obj['cs(User-Agent)'] : ''

  if (method !== 'GET') return { kind: 'ignored' }
  if (status !== '200' && status !== '304') return { kind: 'ignored' }

  const page = pagePathOf(stem)
  if (page !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { kind: 'ignored' }
    const cc = /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : 'ZZ'
    return { kind: 'view', view: { date, country: cc, page, agent: agentOf(ua) } }
  }

  let decodedStem: string
  try {
    decodedStem = decodeURIComponent(stem)
  } catch {
    decodedStem = stem
  }
  if (isAsset(decodedStem)) return { kind: 'ignored' }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { kind: 'ignored' }
  return { kind: 'other-path', date }
}

export type Count = { key: string; visits: number }
export type VisitSummary = {
  days: number
  from: string
  to: string
  visits: number
  crawlers: number
  otherPaths: number
  countries: Count[]
  perDay: Count[]
  pages: Count[]
}

export function addDaysUTC(dateStr: string, offset: number): string {
  const parts = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + offset))
  return dt.toISOString().slice(0, 10)
}

export function sortCounts(arr: Count[]): Count[] {
  return [...arr].sort((a, b) => b.visits - a.visits || a.key.localeCompare(b.key))
}

export type Tally = { add(line: string): void; result(): VisitSummary }

export function createTally(days: number, today: string): Tally {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new RangeError(`today must match YYYY-MM-DD, got ${today}`)
  }
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new RangeError(`days must be an integer 1..366, got ${days}`)
  }
  const to = today
  const from = addDaysUTC(today, -(days - 1))

  let visits = 0
  let crawlers = 0
  let otherPaths = 0
  const countryMap = new Map<string, number>()
  const dayMap = new Map<string, number>()
  const pageMap = new Map<string, number>()

  return {
    add(line: string): void {
      const result = readLogLine(line)
      if (result.kind === 'view') {
        const { date, country, page, agent } = result.view
        if (date < from || date > to) return
        if (agent === 'human') {
          visits++
          countryMap.set(country, (countryMap.get(country) ?? 0) + 1)
          dayMap.set(date, (dayMap.get(date) ?? 0) + 1)
          pageMap.set(page, (pageMap.get(page) ?? 0) + 1)
        } else {
          crawlers++
        }
      } else if (result.kind === 'other-path') {
        if (result.date < from || result.date > to) return
        otherPaths++
      }
    },
    result(): VisitSummary {
      const perDay: Count[] = []
      for (let i = 0; i < days; i++) {
        const d = addDaysUTC(from, i)
        perDay.push({ key: d, visits: dayMap.get(d) ?? 0 })
      }

      return {
        days,
        from,
        to,
        visits,
        crawlers,
        otherPaths,
        countries: sortCounts([...countryMap.entries()].map(([key, v]) => ({ key, visits: v }))),
        perDay,
        pages: sortCounts([...pageMap.entries()].map(([key, v]) => ({ key, visits: v }))),
      }
    },
  }
}

export function summarize(lines: Iterable<string>, days: number, today: string): VisitSummary {
  const tally = createTally(days, today)
  for (const line of lines) {
    tally.add(line)
  }
  return tally.result()
}
