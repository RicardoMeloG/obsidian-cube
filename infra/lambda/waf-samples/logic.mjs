// Pure logic of the web ACL sample collector (spec 020). No AWS here: the
// handler (index.mjs) calls the API and S3; these functions decide what is
// read, what is kept and how a slice is described, and are tested in
// scripts/checks/wafSamples.test.ts.

export const SLICE_MINUTES = 10
export const SLICES_PER_HOUR = 60 / SLICE_MINUTES
export const MAX_ITEMS = 500
// The API reaches three hours back; a slice must start a little after that
// edge to be read whole (the API silently moves an older start, D-2).
export const REACH_MS = 3 * 3600_000
export const EDGE_MARGIN_MS = 60_000
export const PATH_LIMIT = 200
// The owner's own checks end their user agent with this (D-6).
export const OWNER_TEST_MARK = 'obsidian-cube-check'

const HOUR_MS = 3600_000

// `2026-11-21T03` for the hour that starts at 03:00 UTC.
export const hourId = (ms) => new Date(ms).toISOString().slice(0, 13)
export const hourStart = (id) => Date.parse(`${id}:00:00.000Z`)
export const hourKey = (id) => `samples/${id.slice(0, 4)}/${id.slice(5, 7)}/${id.slice(8, 10)}/${id.slice(11, 13)}.json`

// The hour a scheduled run reads: the whole hour before the schedule's time,
// never the clock (D-2).
export function targetHour(eventTime) {
  const ms = Date.parse(eventTime)
  if (Number.isNaN(ms)) throw new Error(`bad event time: ${eventTime}`)
  return hourId(Math.floor(ms / HOUR_MS) * HOUR_MS - HOUR_MS)
}

// The hours to read, oldest first: from the one after the last completed
// hour to the target, at most three (the API's reach). Without a state, only
// the target.
export function hoursToRead(lastDone, target) {
  const end = hourStart(target)
  const first = lastDone ? hourStart(lastDone) + HOUR_MS : end
  const hours = []
  for (let ms = Math.max(first, end - 3 * HOUR_MS); ms <= end; ms += HOUR_MS) hours.push(hourId(ms))
  return hours
}

// The ten-minute slices of an hour, and whether each can still be read whole.
export function slicesOf(id, nowMs) {
  const start = hourStart(id)
  return Array.from({ length: SLICES_PER_HOUR }, (_, i) => {
    const from = start + i * SLICE_MINUTES * 60_000
    const to = from + SLICE_MINUTES * 60_000
    return { from, to, readable: from >= nowMs - REACH_MS + EDGE_MARGIN_MS && to <= nowMs }
  })
}

// How a slice was covered (D-2): every request, a weighted sample, or a
// window the API cut short because it held more than 5,000 requests.
export function coverage({ population, sampled, askedTo, returnedTo }) {
  if (returnedTo < askedTo) return 'truncated'
  if (population > sampled) return 'sampled'
  return 'complete'
}

const BOT_NAMES = /(Googlebot|bingbot|Applebot|DuckDuckBot|YandexBot|Baiduspider|SemrushBot|AhrefsBot|MJ12bot|DotBot|PetalBot|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|PerplexityBot|CCBot|Bytespider|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|Discordbot|TelegramBot|WhatsApp|Embedly|ia_archiver|archive\.org_bot)/i
const LIBRARIES = /^(curl|Wget|python-requests|python-urllib|Python|aiohttp|httpx|Go-http-client|node-fetch|node|undici|axios|okhttp|Java|libwww-perl|Ruby|PostmanRuntime|Scrapy|zgrab)\b/i
// The same words the admin's counter treats as crawlers (server/visits/visitLog.ts).
const CRAWLER_WORDS = /bot|crawl|spider|slurp|fetch|scrape|preview|headless|lighthouse|monitor|uptime|scan|archive/i

// A user agent reduced to a class and a short name; the full string is
// never kept (D-3).
export function classify(userAgent) {
  const ua = (userAgent ?? '').trim()
  if (ua === '' || ua === '-') return { class: 'empty', name: 'none' }
  if (ua.endsWith(OWNER_TEST_MARK)) return { class: 'owner-test', name: 'owner' }
  const bot = ua.match(BOT_NAMES)
  if (bot) return { class: 'crawler', name: bot[1] }
  const lib = ua.match(LIBRARIES)
  if (lib) return { class: 'library', name: lib[1].toLowerCase() }
  if (/HeadlessChrome/i.test(ua)) return { class: 'crawler', name: 'HeadlessChrome' }
  if (CRAWLER_WORDS.test(ua)) return { class: 'crawler', name: 'other' }
  if (!/^Mozilla\//.test(ua)) return { class: 'library', name: 'other' }
  const family =
    /Edg(e|A|iOS)?\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox\/|FxiOS/.test(ua) ? 'Firefox'
    : /SamsungBrowser/.test(ua) ? 'Samsung'
    : /Chrome\/|CriOS/.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'other'
  return { class: 'browser', name: family }
}

// The path only: the query is never kept (owner, 2026-11-21: D-3's option
// stays off), and a path is cut at 200 characters.
export function pathOf(uri) {
  const path = String(uri ?? '').split('?')[0].split('#')[0] || '/'
  return path.length > PATH_LIMIT ? path.slice(0, PATH_LIMIT) : path
}

const sliceStamp = (ms) => new Date(Math.floor(ms / (SLICE_MINUTES * 60_000)) * SLICE_MINUTES * 60_000).toISOString().slice(0, 16) + 'Z'

// One sampled request to one record: no IP, no header, no query (D-3).
// A sample without a readable time is skipped (null), so it cannot stop the
// hour from being written.
export function toRecord(sample, rule) {
  const request = sample.Request ?? {}
  const userAgent = (request.Headers ?? []).find((h) => String(h.Name).toLowerCase() === 'user-agent')?.Value
  const client = classify(userAgent)
  const ts = sample.Timestamp instanceof Date ? sample.Timestamp.getTime() : typeof sample.Timestamp === 'number' && sample.Timestamp < 1e11 ? sample.Timestamp * 1000 : Date.parse(sample.Timestamp)
  if (!Number.isFinite(ts)) return null
  return {
    t: sliceStamp(ts),
    m: String(request.Method ?? '').toUpperCase(),
    p: pathOf(request.URI),
    c: request.Country || 'ZZ',
    a: sample.Action ?? 'ALLOW',
    r: rule,
    g: sample.RuleNameWithinRuleGroup ?? null,
    w: Number(sample.Weight) || 1,
    k: client.class,
    n: client.name,
  }
}

// The rule metric names to sample: the web ACL's default action and each
// rule (D-2), read from the web ACL itself so a changed rule set is followed.
export function ruleMetricNames(webAcl) {
  const names = [webAcl?.VisibilityConfig?.MetricName, ...(webAcl?.Rules ?? []).map((rule) => rule.VisibilityConfig?.MetricName)]
  return [...new Set(names.filter(Boolean))]
}

// `arn:aws:wafv2:us-east-1:<account>:global/webacl/<name>/<id>` to its parts.
export function webAclRef(arn) {
  const match = /^arn:aws:wafv2:us-east-1:\d{12}:global\/webacl\/([^/]+)\/([^/]+)$/.exec(arn ?? '')
  if (!match) throw new Error(`not a CloudFront-scope web ACL ARN: ${arn}`)
  return { name: match[1], id: match[2] }
}
