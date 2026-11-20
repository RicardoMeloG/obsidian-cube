// Deterministic fixture generator for the admin visits dashboard.
// In development the dashboard runs against this file with no AWS dependency.
// Output is fully deterministic (seeded PRNG) so the file only changes when this script does.

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const outUrl = new URL('../server/visits/fixtures/sample-logs.jsonl', import.meta.url)
const outPath = fileURLToPath(outUrl)
mkdirSync(dirname(outPath), { recursive: true })

function mulberry32(seed) {
  let s = seed | 0
  return function () {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(13)

function weightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r < 0) return items[i]
  }
  return items[items.length - 1]
}

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)]
}

function encodeUA(ua) {
  return ua.replace(/ /g, '%20')
}

function randomTime() {
  const h = String(Math.floor(rand() * 24)).padStart(2, '0')
  const m = String(Math.floor(rand() * 60)).padStart(2, '0')
  const s = String(Math.floor(rand() * 60)).padStart(2, '0')
  return h + ':' + m + ':' + s
}

const COUNTRIES = ['CL','US','ES','AR','MX','DE','GB','BR','IN','CA','FR','NL','JP','PE','CO','AU','-']
const COUNTRY_WEIGHTS = [25,12,9,7,7,4,4,4,3,3,3,2,2,3,3,2,2]
const SPANISH_PAGES = ['/es','/es/agentico','/es/productos','/es/sistemas','/es/seguridad','/es/investigacion','/es/contacto','/es/seguridad.html','/es/']
const SPANISH_WEIGHTS = [2,1,1,1,1,1,1,1,1]
const ENGLISH_PAGES = ['/','/agentic','/products','/systems','/security','/research','/contact','/llms.txt','/profile']
const ENGLISH_WEIGHTS = [2,1,1,1,1,1,1,1,1]
const SPANISH_COUNTRIES = new Set(['CL','ES','AR','MX','PE','CO'])
const BROWSER_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
]
const CRAWLER_UAS = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'GPTBot/1.0; +https://openai.com/gptbot',
  'ClaudeBot/1.0; +https://claude.ai/bot',
  'PerplexityBot/1.0; +https://perplexity.ai'
]
const ASSET_PATHS = ['/assets/index-3f9a2c.js','/assets/index-77be10.css','/favicon.svg','/og-image.jpg','/content/site.es.json','/robots.txt']
const SCANNER_PATHS = ['/wp-login.php','/.env','/admin.php','/xmlrpc.php','/wp-admin/']
const SCANNER_UAS = ['Mozilla/5.0 zgrab/0.x','python-requests/2.31']
const SCANNER_COUNTRIES = ['US','NL','SG','RU']

const START = Date.UTC(2026, 9, 14)
const END = Date.UTC(2026, 10, 12)
const DAY_MS = 86400000
const days = []
for (let t = START; t <= END; t += DAY_MS) days.push(t)

function fmtDate(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

const lines = []

function makeLine(date, time, country, method, uri, status, ua) {
  return {
    date: date,
    time: time,
    'c-country': country,
    'cs-method': method,
    'cs-uri-stem': uri,
    'sc-status': status,
    'cs(User-Agent)': encodeUA(ua)
  }
}

for (let i = 0; i < days.length; i++) {
  const dateStr = fmtDate(days[i])
  const isLast7 = i >= days.length - 7

  const count = isLast7 ? 6 + Math.floor(rand() * 6) : 2 + Math.floor(rand() * 3)
  for (let j = 0; j < count; j++) {
    const country = weightedPick(COUNTRIES, COUNTRY_WEIGHTS)
    const useSpanish = SPANISH_COUNTRIES.has(country) && rand() < 0.75
    const page = useSpanish
      ? weightedPick(SPANISH_PAGES, SPANISH_WEIGHTS)
      : weightedPick(ENGLISH_PAGES, ENGLISH_WEIGHTS)
    const status = rand() < 0.04 ? '304' : '200'
    const ua = pick(BROWSER_UAS)
    lines.push(makeLine(dateStr, randomTime(), country, 'GET', page, status, ua))
  }

  if (rand() < 0.6) {
    const ua = pick(CRAWLER_UAS)
    const country = rand() < 0.7 ? 'US' : pick(['IE', 'DE'])
    const page = weightedPick(ENGLISH_PAGES, ENGLISH_WEIGHTS)
    lines.push(makeLine(dateStr, randomTime(), country, 'GET', page, '200', ua))
  }

  if (rand() < 0.5) {
    const country = weightedPick(COUNTRIES, COUNTRY_WEIGHTS)
    const path = pick(ASSET_PATHS)
    const ua = pick(BROWSER_UAS)
    lines.push(makeLine(dateStr, randomTime(), country, 'GET', path, '200', ua))
  }

  // CloudFront rewrites the origin's 403/404 to 200, so the logged sc-status is always 200.
  if (rand() < 0.2) {
    const country = pick(SCANNER_COUNTRIES)
    const path = pick(SCANNER_PATHS)
    const ua = pick(SCANNER_UAS)
    lines.push(makeLine(dateStr, randomTime(), country, 'GET', path, '200', ua))
  }
}

const fixedDates = ['2026-11-03', '2026-11-09']
for (const d of fixedDates) {
  lines.push(makeLine(d, randomTime(), 'US', 'POST', '/contact', '403', pick(BROWSER_UAS)))
  lines.push(makeLine(d, randomTime(), 'US', 'GET', '/missing', '404', pick(BROWSER_UAS)))
}

lines.sort(function (a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.time !== b.time) return a.time < b.time ? -1 : 1
  return 0
})

const jsonl = lines.map(function (l) { return JSON.stringify(l) }).join('\n') + '\n'
writeFileSync(outPath, jsonl, 'utf8')
console.log('Wrote ' + lines.length + ' lines to ' + outPath)
