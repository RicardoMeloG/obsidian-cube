// Use cases on the published site (docs/live-use-cases.md): what each kind of
// visitor does on ricardomelog.com, run in a real browser, with the console
// watched the whole time. A reviewer may open the developer tools, so any
// error, warning, failed request or CSP violation fails the run.
//
//   node scripts/check-live.mjs                       https://ricardomelog.com
//   node scripts/check-live.mjs --url=http://127.0.0.1:5181   a local preview
//   node scripts/check-live.mjs --only=CU-03,CU-09
//   node scripts/check-live.mjs --force               skip the five-minute pause
//
// Read-only: it opens pages and reads headers, it never posts anything.
//
// The WAF blocks a client above 300 requests in 5 minutes, and one full run
// makes about 150 to 200 (dt-01). Two runs in a row block the owner's own IP
// and the site looks down. So a run on the live site waits five minutes after
// the previous one, and stops at the first sign of the block, saying so,
// instead of reporting every later use case as a failure of the site.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

// Every request of a run ends its user agent with this mark, so the web ACL
// sample collector tells the owner's checks from visitors (spec 020, D-6).
// The mark is public: it only sorts, it never grants anything.
const CHECK_MARK = 'obsidian-cube-check'
const fetch = (url, init = {}) => {
  const headers = new Headers(init.headers)
  if (!headers.has('user-agent')) headers.set('user-agent', `node ${CHECK_MARK}`)
  return globalThis.fetch(url, { ...init, headers })
}

const BASE = (process.argv.find((arg) => arg.startsWith('--url='))?.slice(6) ?? 'https://ricardomelog.com').replace(/\/$/, '')
const ONLY = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7).split(',')
const LIVE = BASE.startsWith('https://')
const FORCE = process.argv.includes('--force')
// The WAF's window, and where the last live run is stamped (outside the repo).
const WAF_WINDOW_MS = 5 * 60 * 1000
const STAMP = join(tmpdir(), 'obsidian-cube-check-live', `${new URL(BASE).hostname}.last-run`)

// The WAF refuses the client: the home page, which is public, answers 403, or
// CloudFront answers it with its own error instead of the site.
async function wafBlocked() {
  try {
    const response = await fetch(`${BASE}/`)
    return response.status === 403 || response.status === 429 || /Error from cloudfront/i.test(response.headers.get('x-cache') ?? '')
  } catch {
    return false
  }
}

function stopForWaf(when) {
  console.log(`\nSTOPPED ${when}: the WAF is refusing this IP (the home page answers 403 or 429).`)
  console.log('This is the rate limit of 300 requests in 5 minutes, not a failure of the site: it lifts by itself in a few minutes.')
  console.log('Wait at least 5 minutes before running check:live again.')
  process.exit(2)
}

if (LIVE) {
  const last = existsSync(STAMP) ? Number(readFileSync(STAMP, 'utf8')) : 0
  const wait = last + WAF_WINDOW_MS - Date.now()
  if (wait > 0 && !FORCE) {
    console.log(`The last run on ${BASE} was ${Math.round((Date.now() - last) / 1000)} s ago. Another one now could trip the WAF's limit`)
    console.log(`(300 requests in 5 minutes) and block this IP. Try again in ${Math.ceil(wait / 1000)} s, or pass --force.`)
    process.exit(2)
  }
  if (await wafBlocked()) stopForWaf('before starting')
  mkdirSync(join(tmpdir(), 'obsidian-cube-check-live'), { recursive: true })
  // Stamped again on the way out, however the run ends: the WAF's window
  // slides, so the next run waits five minutes from this run's last request.
  // A failed write only loses the wait, so it never replaces the exit code.
  const stamp = () => {
    try {
      writeFileSync(STAMP, String(Date.now()))
    } catch (error) {
      console.warn(`Could not stamp ${STAMP}: ${error.message}`)
    }
  }
  stamp()
  process.on('exit', stamp)
  // Ctrl+C or a kill skips 'exit' unless the process leaves through it.
  process.on('SIGINT', () => process.exit(130))
  process.on('SIGTERM', () => process.exit(143))
}
const NO_WEBGL = ['--disable-webgl', '--disable-webgl2']
const SOFTWARE_WEBGL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
// Software WebGL lacks an extension every real GPU driver has; three.js says so
// once. It is the test machine talking, not the site, so only that line is
// excused, and only in runs on software WebGL.
const SOFTWARE_ONLY = [/KHR_parallel_shader_compile extension not supported/]

const results = []
const launch = (args) => chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args })

// A page whose console, network and errors are recorded for the use case.
async function watchedPage(browser, problems, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', ...options })
  const page = await context.newPage()
  const browserAgent = await page.evaluate(() => navigator.userAgent)
  await context.setExtraHTTPHeaders({ 'user-agent': `${browserAgent} ${CHECK_MARK}` })
  // A request the browser drops because the page moved on (a new address, a
  // face change) or the test closed it is not a failure of the site: the
  // console shows nothing, only the network panel marks it cancelled. One cut
  // short on a page that stayed put still counts (dt-01).
  let navigations = 0
  let closing = false
  const startedAt = new WeakMap()
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations += 1
  })
  page.on('request', (request) => startedAt.set(request, navigations))
  const close = async () => {
    closing = true
    await context.close()
  }
  const excused = options.softwareWebgl ? SOFTWARE_ONLY : []
  page.on('console', (message) => {
    if (!['error', 'warning'].includes(message.type())) return
    const text = message.text()
    if (excused.some((pattern) => pattern.test(text))) return
    problems.push(`console ${message.type()}: ${text.slice(0, 200)}`)
  })
  page.on('pageerror', (error) => problems.push(`page error: ${error.message.slice(0, 200)}`))
  page.on('requestfailed', (request) => {
    // A navigation the test itself cuts short is not a failure of the site.
    if (request.failure()?.errorText === 'net::ERR_ABORTED') {
      if (request.resourceType() === 'document' || closing || (startedAt.get(request) ?? navigations) < navigations) return
    }
    problems.push(`request failed: ${request.url()} ${request.failure()?.errorText}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`)
  })
  return { context, page, close }
}

let blocked = false

async function useCase(id, title, run) {
  if (ONLY && !ONLY.includes(id)) return
  if (blocked) return
  const problems = []
  const started = Date.now()
  try {
    await run(problems)
  } catch (error) {
    problems.push(`stopped: ${error.message.split('\n')[0].slice(0, 200)}`)
  }
  // A failure may be the WAF's block rather than the site: check once, and
  // if so, report it as such and run nothing more.
  if (problems.length && LIVE && (await wafBlocked())) {
    blocked = true
    console.log(`WAF  ${id} ${title}: the WAF started refusing this IP during the case; its problems are not counted.`)
    return
  }
  results.push({ id, title, problems, seconds: ((Date.now() - started) / 1000).toFixed(1) })
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${id} ${title} (${results.at(-1).seconds} s)`)
  for (const problem of problems) console.log(`       ${problem}`)
}

const expect = (problems, ok, message) => {
  if (!ok) problems.push(message)
}
const visible = (page, selector) =>
  page.evaluate((s) => {
    const element = document.querySelector(s)
    return Boolean(element) && getComputedStyle(element).visibility !== 'hidden' && element.getBoundingClientRect().height > 0
  }, selector)
const idle = (page, face) => page.waitForSelector(`.stage[data-transition="idle"]${face ? `[data-face="${face}"]` : ''}`, { timeout: 60000 })

const softwareBrowser = await launch(SOFTWARE_WEBGL)
const noWebglBrowser = await launch(NO_WEBGL)
console.log(`Use cases on ${BASE}`)

try {
  // CU-01: a recruiter clicks the link on the CV, on a desktop, browser in English.
  await useCase('CU-01', 'Recruiter from the CV: first visit, intro, name in seconds, picks a face', async (problems) => {
    const { context, page, close } = await watchedPage(softwareBrowser, problems, { viewport: { width: 1366, height: 768 }, softwareWebgl: true })
    context.setDefaultTimeout(120000)
    const response = await page.goto(`${BASE}/`)
    expect(problems, response.status() === 200, `home answered ${response.status()}`)
    expect(problems, (await page.title()).includes('Ricardo Melo'), `title without the name: ${await page.title()}`)
    // The name is in the HTML before any script, for the first second.
    const served = await page.content()
    expect(problems, served.includes('Ricardo Melo'), 'the name is not in the served page')
    await page.waitForSelector('[data-intro]', { timeout: 30000 }).catch(() => {})
    await page.keyboard.press('Space')
    await page.waitForFunction(() => !document.querySelector('[data-intro]'), null, { timeout: 15000 })
    expect(problems, await visible(page, '.stage-top'), 'the top (name, language) is hidden after the intro')
    // The top fades in as the intro hands over; give it the time a person would.
    const named = await page
      .waitForFunction(() => document.querySelector('.stage-top')?.innerText.includes('Ricardo'), null, { timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(problems, named, 'the name is not in the top once the intro ends')
    let picked = false
    for (let attempt = 0; attempt < 6 && !picked; attempt += 1) {
      await page.waitForTimeout(1500)
      await page.mouse.click(683, Math.round(768 * 0.45))
      picked = await page.waitForSelector('.stage:not([data-explore])', { timeout: 2500 }).then(() => true).catch(() => false)
    }
    expect(problems, picked, 'a click on the cube opened no face')
    if (picked) {
      await idle(page)
      expect(problems, await visible(page, '.stage-content'), 'the face content is hidden after the pick')
      expect(problems, /^\/[a-z]+$/.test(new URL(page.url()).pathname), `address did not follow the face: ${page.url()}`)
    }
    await close()
  })

  // CU-02: a visitor whose browser is in Spanish arrives at the bare address.
  await useCase('CU-02', 'Spanish visitor: lands in Spanish and moves through the faces with the dock', async (problems) => {
    const { context, page, close } = await watchedPage(noWebglBrowser, problems, { locale: 'es-CL' })
    await page.goto(`${BASE}/?intro=0`)
    await idle(page)
    await page.waitForFunction(() => location.pathname === '/es', null, { timeout: 5000 }).catch(() => problems.push(`stayed on ${page.url()}`))
    expect(problems, (await page.evaluate(() => document.documentElement.lang)) === 'es', 'page language is not es')
    const titles = new Set()
    for (const [face, slug] of [['security', 'seguridad'], ['products', 'productos'], ['contact', 'contacto']]) {
      await page.click(`.stage-dock a[data-section-id="${face}"]`)
      await idle(page, face)
      expect(problems, new URL(page.url()).pathname === `/es/${slug}`, `dock to ${face} left the address at ${page.url()}`)
      titles.add(await page.title())
    }
    expect(problems, titles.size === 3, 'faces share a title')
    await close()
  })

  // CU-03: someone receives a shared link to a face and switches the language.
  await useCase('CU-03', 'Shared link to a face: opens on it, the language switch keeps the face', async (problems) => {
    const { context, page, close } = await watchedPage(noWebglBrowser, problems, { locale: 'es-CL' })
    await page.goto(`${BASE}/es/productos?intro=0`)
    await idle(page, 'products')
    expect(problems, (await page.title()) !== '', 'empty title')
    await page.click('.stage-locale button:text-is("EN")')
    const switched = await page
      .waitForFunction(() => location.pathname === '/products' && document.documentElement.lang === 'en', null, { timeout: 10000 })
      .then(() => true)
      .catch(() => false)
    expect(problems, switched, `language switch went to ${page.url()}`)
    // A later visit to the bare address remembers English.
    await page.goto(`${BASE}/?intro=0`)
    await idle(page)
    await page.waitForTimeout(500)
    expect(problems, new URL(page.url()).pathname === '/', `the bare address moved to ${page.url()}`)
    await close()
  })

  // CU-04: the same link opened on a phone, from LinkedIn or WhatsApp.
  await useCase('CU-04', 'Phone (390 px): the face reads without sideways scrolling and the dock works', async (problems) => {
    const { context, page, close } = await watchedPage(softwareBrowser, problems, {
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'es-CL', softwareWebgl: true,
    })
    context.setDefaultTimeout(120000)
    await page.goto(`${BASE}/es/seguridad?intro=0`)
    await idle(page, 'security')
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(problems, wide <= 0, `the page scrolls sideways by ${wide} px`)
    expect(problems, await visible(page, '.stage-content'), 'the face content is hidden on the phone')
    await page.tap('.stage-dock a[data-section-id="systems"]')
    await idle(page, 'systems')
    expect(problems, new URL(page.url()).pathname === '/es/sistemas', `dock tap left the address at ${page.url()}`)
    await close()
  })

  // CU-05: a keyboard user opens a face's detail and leaves it.
  await useCase('CU-05', 'Keyboard: opens a detail, Tab stays inside, Esc closes and returns focus', async (problems) => {
    const { context, page, close } = await watchedPage(noWebglBrowser, problems)
    await page.goto(`${BASE}/agentic?intro=0`)
    await idle(page, 'agentic')
    const trigger = page.locator('.stage-content button.st-button').first()
    await trigger.focus()
    await page.keyboard.press('Enter')
    await page.waitForSelector('dialog[open]', { timeout: 5000 })
    for (let step = 0; step < 4; step += 1) {
      await page.keyboard.press(step < 2 ? 'Tab' : 'Shift+Tab')
      const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]')))
      expect(problems, inside, 'focus left the open dialog')
    }
    await page.keyboard.press('Escape')
    await page.waitForSelector('dialog[open]', { state: 'detached', timeout: 5000 }).catch(() => problems.push('Esc did not close the dialog'))
    const back = await page.evaluate(() => document.activeElement?.classList.contains('st-button') ?? false)
    expect(problems, back, 'focus did not return to the button that opened the detail')
    await close()
  })

  // CU-06: a curious visitor plays with the cube and comes back.
  await useCase('CU-06', 'Cube mode: the interface steps aside and Esc brings it back', async (problems) => {
    const { context, page, close } = await watchedPage(softwareBrowser, problems, { softwareWebgl: true })
    context.setDefaultTimeout(120000)
    await page.goto(`${BASE}/systems?intro=0`)
    await idle(page, 'systems')
    await page.click('.stage-explore')
    await page.waitForSelector('.stage[data-explore]', { timeout: 5000 })
    // Wait for the fade to end, not a fixed time: software WebGL keeps the
    // main thread busy and 700 ms sometimes measured mid-fade (dt-23).
    const contentHidden = (want) =>
      page
        .waitForFunction((hidden) => (getComputedStyle(document.querySelector('.stage-content')).visibility === 'hidden') === hidden, want, { timeout: 10000 })
        .catch(() => {})
    await contentHidden(true)
    expect(problems, !(await visible(page, '.stage-content')), 'content still shows in cube mode')
    await page.keyboard.press('Escape')
    await page.waitForSelector('.stage:not([data-explore])', { timeout: 5000 }).catch(() => problems.push('Esc did not leave cube mode'))
    await contentHidden(false)
    expect(problems, await visible(page, '.stage-content'), 'content did not come back')
    await close()
  })

  // CU-07: an old laptop, a locked-down corporate browser: no WebGL.
  await useCase('CU-07', 'No WebGL: a still of the cube, the whole interface, no errors', async (problems) => {
    const { context, page, close } = await watchedPage(noWebglBrowser, problems)
    await page.goto(`${BASE}/research?intro=0`)
    await idle(page, 'research')
    expect(problems, await visible(page, '.stage-content'), 'content hidden without WebGL')
    expect(problems, !(await page.$('canvas')), 'a canvas was created without WebGL')
    await close()
  })

  // CU-08: a visitor who asked the system for less motion.
  await useCase('CU-08', 'Reduced motion: no intro, the site opens ready to read', async (problems) => {
    const { context, page, close } = await watchedPage(softwareBrowser, problems, { reducedMotion: 'reduce', softwareWebgl: true })
    context.setDefaultTimeout(120000)
    await page.goto(`${BASE}/`)
    await idle(page)
    expect(problems, !(await page.$('[data-intro="pending"]')), 'the intro played despite reduced motion')
    expect(problems, await visible(page, '.stage-top'), 'the top is hidden')
    await close()
  })

  // CU-09: machines: answer engines, crawlers and link previews read the raw HTML.
  await useCase('CU-09', 'Machines: raw HTML carries the name, preview card, JSON-LD and llms.txt', async (problems) => {
    const html = await (await fetch(`${BASE}/`)).text()
    for (const [label, pattern] of [
      ['name in the HTML', /Ricardo Melo/],
      ['description', /<meta name="description" content="[^"]{40,}"/],
      ['Open Graph title', /<meta property="og:title"/],
      ['Open Graph image', /<meta property="og:image" content="https:\/\/[^"]+"/],
      ['JSON-LD Person', /application\/ld\+json[\s\S]*"Person"/],
      ['canonical address', /<link rel="canonical" href="https:\/\/[^"]+"/],
    ]) expect(problems, pattern.test(html), `home HTML lacks the ${label}`)
    const es = await (await fetch(`${BASE}/es/seguridad`)).text()
    expect(problems, es.includes('<html lang="es"'), '/es/seguridad is not served in Spanish')
    for (const file of ['llms.txt', 'profile.html', 'profile.es.html', 'og-image.jpg']) {
      const response = await fetch(`${BASE}/${file}`)
      expect(problems, response.ok, `/${file} answered ${response.status}`)
    }
    const llms = await (await fetch(`${BASE}/llms.txt`)).text()
    expect(problems, /^# Ricardo .*Melo/.test(llms), 'llms.txt does not open with the name')
  })

  // CU-10: a reviewer checks the security posture from the outside.
  await useCase('CU-10', 'Security from outside: headers, HTTPS only, nothing private reachable', async (problems) => {
    const response = await fetch(`${BASE}/`)
    const header = (name) => response.headers.get(name) ?? ''
    expect(problems, /default-src 'self'/.test(header('content-security-policy')), 'no enforced Content-Security-Policy')
    expect(problems, header('x-frame-options') === 'DENY', 'X-Frame-Options is not DENY')
    expect(problems, header('x-content-type-options') === 'nosniff', 'no nosniff')
    expect(problems, header('referrer-policy') !== '', 'no Referrer-Policy')
    expect(problems, header('permissions-policy').includes('camera=()'), 'no Permissions-Policy')
    expect(problems, !/AmazonS3/i.test(header('server')), 'the origin shows itself in Server')
    if (LIVE) {
      expect(problems, /max-age=\d{8,}/.test(header('strict-transport-security')), 'no long Strict-Transport-Security')
      const plain = await fetch(BASE.replace('https://', 'http://') + '/', { redirect: 'manual' })
      expect(problems, plain.status === 301 && plain.headers.get('location')?.startsWith('https://'), `HTTP answered ${plain.status} instead of moving to HTTPS`)
      const www = await fetch(BASE.replace('https://', 'https://www.') + '/')
      expect(problems, www.ok, `www answered ${www.status}`)
    }
    // Private files never reach the visitor, and an unknown path is a real
    // 404 with the static 404 page, not the home page (spec 010, AD-09). A
    // private path may also be refused by the WAF first (403, e.g. /.env).
    // /content/site.*.json is the published content the page itself reads.
    for (const path of ['/.env', '/.git/config', '/content/drafts/', '/server/.env', '/package.json', '/db/', '/infra/cdk.json', '/no-such-page', '/es/no-existe']) {
      const response = await fetch(`${BASE}${path}`)
      const body = await response.text()
      const leaked = /DATABASE_URL|SESSION_SECRET|\[core\]|"dependencies"|certificateArn|ListBucketResult/.test(body)
      expect(problems, !leaked, `${path} serves private content`)
      const notFound = response.status === 404 && body.includes('<h1>404</h1>')
      expect(problems, notFound || response.status === 403, `${path} answered ${response.status} instead of the 404 page or a refusal`)
    }
    // The bucket is never listed, whatever the root looks like.
    for (const path of ['/?list-type=2', '//?list-type=2', '//']) {
      const body = await (await fetch(`${BASE}${path}`)).text()
      expect(problems, !body.includes('ListBucketResult'), `${path} lists the bucket`)
    }
  })

  // CU-11: the owner's rules: the CV is never on the site, no tracking.
  await useCase('CU-11', 'Owner rules: no CV to download, no third-party trackers, no cookies', async (problems) => {
    const { context, page, close } = await watchedPage(noWebglBrowser, problems)
    const hosts = new Set()
    page.on('request', (request) => hosts.add(new URL(request.url()).host))
    for (const path of ['/contact?intro=0', '/es/contacto?intro=0']) {
      await page.goto(`${BASE}${path}`)
      await idle(page, 'contact')
      const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((link) => link.getAttribute('href')))
      const cv = links.filter((href) => /\.(pdf|docx?)(\?|$)|curr[ií]cul|resume|\bcv\b/i.test(href))
      expect(problems, cv.length === 0, `CV link on ${path}: ${cv.join(', ')}`)
    }
    const own = new URL(BASE).host
    const foreign = [...hosts].filter((host) => host !== own)
    expect(problems, foreign.length === 0, `requests to other hosts: ${foreign.join(', ')}`)
    expect(problems, (await context.cookies()).length === 0, 'the site set cookies')
    await close()
  })

  // CU-12: every address in both languages opens clean, on a desktop.
  await useCase('CU-12', 'Every page in both languages opens with a clean console', async (problems) => {
    const { context, page, close } = await watchedPage(softwareBrowser, problems, { softwareWebgl: true })
    context.setDefaultTimeout(120000)
    const faces = { en: ['', 'agentic', 'products', 'systems', 'security', 'research', 'contact'], es: ['', 'agentico', 'productos', 'sistemas', 'seguridad', 'investigacion', 'contacto'] }
    for (const [locale, slugs] of Object.entries(faces)) {
      for (const slug of slugs) {
        const path = [locale === 'es' ? '/es' : '', slug ? `/${slug}` : ''].join('') || '/'
        const response = await page.goto(`${BASE}${path}?intro=0`)
        expect(problems, response.status() === 200, `${path} answered ${response.status()}`)
        await idle(page)
        await page.waitForTimeout(1200)
      }
    }
    await close()
  })
  // CU-13: crawlers find the site's map, and browsers cache what can be cached
  // (ADR 009, spec 018 D-6; pending item dt-35).
  await useCase('CU-13', 'Crawlers and caches: robots, sitemap, and Cache-Control by path', async (problems) => {
    const origin = LIVE ? new URL(BASE).origin : 'https://ricardomelog.com'
    const robots = await fetch(`${BASE}/robots.txt`)
    const robotsText = await robots.text()
    expect(problems, robots.status === 200 && /^text\/plain/.test(robots.headers.get('content-type') ?? ''), `robots.txt answered ${robots.status} ${robots.headers.get('content-type')}`)
    expect(problems, robotsText.includes(`Sitemap: ${origin}/sitemap.xml`), 'robots.txt does not name the sitemap')
    for (const agent of ['GPTBot', 'ClaudeBot', 'PerplexityBot', '*']) {
      expect(problems, new RegExp(`User-agent: ${agent.replace('*', '\\*')}\\nAllow: /`).test(robotsText), `robots.txt does not allow ${agent}`)
    }
    const sitemap = await fetch(`${BASE}/sitemap.xml`)
    const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
    expect(problems, sitemap.status === 200 && /xml/.test(sitemap.headers.get('content-type') ?? ''), `sitemap.xml answered ${sitemap.status} ${sitemap.headers.get('content-type')}`)
    for (const path of ['/', '/agentic', '/contact', '/es', '/es/seguridad', '/es/contacto', '/methodology', '/es/metodologia']) {
      expect(problems, locs.includes(`${origin}${path}`), `sitemap.xml does not list ${path}`)
    }
    expect(problems, locs.length === 16, `sitemap.xml lists ${locs.length} pages, not 16 (the cube and 6 faces, and the methodology, in 2 languages)`)
    // The edge function sets these (spec 018): vite preview does not.
    if (LIVE) {
      const asset = (await (await fetch(`${BASE}/`)).text()).match(/\/assets\/[^"']+\.js/)?.[0]
      const cacheOf = async (path) => (await fetch(`${BASE}${path}`)).headers.get('cache-control') ?? ''
      expect(problems, Boolean(asset) && /max-age=31536000/.test(await cacheOf(asset)) && /immutable/.test(await cacheOf(asset)), `a hashed asset (${asset}) is not cached for a year and immutable`)
      for (const path of ['/', '/es/seguridad', '/content/site.es.json', '/sitemap.xml']) {
        expect(problems, /no-cache/.test(await cacheOf(path)), `${path} is not revalidated (Cache-Control: ${await cacheOf(path)})`)
      }
    }
  })

  // CU-14: a visitor on a desktop contemplates a world and comes back (spec 017).
  await useCase('CU-14', 'Art mode: a double-click on the world shows it alone, signed; Esc comes back', async (problems) => {
    const { context, page, close } = await watchedPage(softwareBrowser, problems, { viewport: { width: 1600, height: 900 }, softwareWebgl: true })
    context.setDefaultTimeout(120000)
    await page.goto(`${BASE}/agentic?intro=0`)
    await idle(page, 'agentic')
    // The centre of a desktop is kept clear for the cube (check:layout), so a
    // double-click there lands on the world, not on the interface.
    // The mode opens only once the scene is ready (spec 017), which on
    // software WebGL comes a few seconds after the stage: try again until then.
    // A double-click on the opening layer would close it again, so another
    // one is sent only while the mode has not started.
    const phase = () => page.evaluate(() => document.querySelector('.art-mode')?.getAttribute('data-phase') ?? 'off')
    let started = false
    for (let attempt = 0; attempt < 8 && !started; attempt++) {
      await page.mouse.dblclick(800, 450)
      started = await page
        .waitForFunction(() => ['covering', 'on'].includes(document.querySelector('.art-mode')?.getAttribute('data-phase') ?? 'off'), null, { timeout: 8000 })
        .then(() => true)
        .catch(() => false)
    }
    const shown = started && (await page.waitForSelector('.art-mode[data-phase="on"]', { timeout: 90000 }).then(() => true).catch(() => false))
    if (started && !shown) problems.push(`art mode started but never showed (phase ${await phase()})`)
    expect(problems, shown, 'art mode did not open on a double-click')
    if (shown) {
      const signature = (await page.locator('.art-mode__signature').textContent())?.trim() ?? ''
      expect(problems, signature.length > 0, 'the art mode is not signed with the owner name')
      // The layer covers the page: what is under the centre and the corners is the art.
      const covered = await page.evaluate(() =>
        [[0.5, 0.5], [0.05, 0.1], [0.95, 0.9]].every(([x, y]) => document.elementFromPoint(innerWidth * x, innerHeight * y)?.closest('.art-mode') !== null),
      )
      expect(problems, covered, 'the art mode does not cover the page')
      await page.keyboard.press('Escape')
      const left = await page
        .waitForFunction(() => !document.querySelector('.art-mode') || document.querySelector('.art-mode')?.getAttribute('data-phase') === 'off', null, { timeout: 15000 })
        .then(() => true)
        .catch(() => false)
      expect(problems, left, 'Esc did not leave art mode')
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.stage-content')).visibility !== 'hidden', null, { timeout: 10000 }).catch(() => {})
      expect(problems, await visible(page, '.stage-content'), 'the stage did not come back after art mode')
    }
    await close()
  })

  // CU-15: a technical reviewer reads the methodology (spec 022).
  await useCase('CU-15', 'The methodology reads without JavaScript, in both languages, on a small phone', async (problems) => {
    const { page, close } = await watchedPage(noWebglBrowser, problems, { viewport: { width: 320, height: 640 } })
    for (const [path, lang, other] of [['/methodology', 'en', '/es/metodologia'], ['/es/metodologia', 'es', '/methodology']]) {
      const raw = await fetch(`${BASE}${path}`)
      const html = await raw.text()
      const header = (name) => raw.headers.get(name) ?? ''
      expect(problems, raw.status === 200 && /^text\/html/.test(header('content-type')), `${path} answered ${raw.status} ${header('content-type')}`)
      expect(problems, /default-src 'self'/.test(header('content-security-policy')) && header('x-frame-options') === 'DENY', `${path} lacks the security headers`)
      expect(problems, html.includes(`<html lang="${lang}">`), `${path} is not served in ${lang}`)
      expect(problems, !/<script(?! type="application\/ld\+json")/.test(html), `${path} carries a script`)
      expect(problems, /<main class="method">\s*<h1>/.test(html), `${path} lacks its text in the raw HTML`)
      await page.goto(`${BASE}${path}`)
      expect(problems, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} scrolls sideways at 320 px`)
      expect(problems, (await page.locator(`a[href="${other}"]`).count()) > 0, `${path} does not link ${other}`)
      // The sheet is applied: the figure is drawn and the font is the site's.
      expect(problems, await page.evaluate(() => getComputedStyle(document.querySelector('.loop-box')).fill !== 'rgb(0, 0, 0)'), `${path} is not styled`)
    }
    await close()
  })
} finally {
  await softwareBrowser.close()
  await noWebglBrowser.close()
}

if (blocked) stopForWaf(`after ${results.length} use cases (${results.filter((result) => !result.problems.length).length} passed)`)

const failed = results.filter((result) => result.problems.length)
console.log(`\n${results.length - failed.length} of ${results.length} use cases passed on ${BASE}`)
process.exit(failed.length ? 1 : 0)
