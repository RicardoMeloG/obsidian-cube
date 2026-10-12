// Layout and accessibility check (spec 010, H-06 and H-13).
//
// Serves the built site with `vite preview`, opens one page per viewport and
// locale, walks the six faces by clicking the face strip and asserts DOM
// geometry (no pixel diffs). Each failure has a stable id; the ids recorded in
// scripts/checks/layout-known.json are known debt and do not fail the run, any
// other id does. A known id that no longer fails is reported so the list only
// shrinks.
//
//   node scripts/check-layout.mjs              PR matrix (3 viewports)
//   node scripts/check-layout.mjs --full       full matrix (8 viewports)
//   node scripts/check-layout.mjs --update-known   record current failures as known
//   node scripts/check-layout.mjs --content=stress every field at its budget
//   node scripts/check-layout.mjs --content=example  the committed example
//
// Without --content the check uses what the build contains: the example in CI,
// the private content on the owner's machine (run it before publishing). With
// --content the documents are served by the check itself, and every failure
// fails: content that the admin accepts must always fit.
//
// Requires `npm run build` first. WebGL runs in software (SwiftShader) so the
// result does not depend on the machine's GPU.

import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildStressContent } from './checks/stressContent.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')

const KNOWN_PATH = fileURLToPath(new URL('./checks/layout-known.json', import.meta.url))
const PORT = 4179
const BASE = `http://127.0.0.1:${PORT}`

const PR_VIEWPORTS = ['1600x725', '1366x768', '390x844']
const FULL_VIEWPORTS = ['2048x1152', '1920x1080', '1600x725', '1536x864', '1440x900', '1366x768', '1280x720', '768x1024', '390x844']
const LOCALES = ['en', 'es']
const FACES = ['agentic', 'products', 'systems', 'security', 'research', 'contact']

// The mode queries come from their single source, src/styles/layoutModes.ts.
const modesSource = readFileSync(fileURLToPath(new URL('../src/styles/layoutModes.ts', import.meta.url)), 'utf8')
const modeQuery = (name) => new RegExp(`${name}: '([^']+)'`).exec(modesSource)[1]
const MODE_QUERIES = { stacked: modeQuery('stacked'), short: modeQuery('desktopShort') }

const args = new Set(process.argv.slice(2))
const viewports = args.has('--full') ? FULL_VIEWPORTS : PR_VIEWPORTS
const contentMode = process.argv.find((arg) => arg.startsWith('--content='))?.split('=')[1] ?? 'built'
if (!['built', 'stress', 'example'].includes(contentMode)) throw new Error(`Unknown --content=${contentMode}`)

const readJson = (path) => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'))
const budgets = readJson('../src/kernel/layoutBudgets.json')
const examples = { en: readJson('../public/content/site.example.en.json'), es: readJson('../public/content/site.example.es.json') }

// Serves the site documents for --content=stress|example.
async function serveContent(context) {
  if (contentMode === 'built') return
  await context.route('**/content/site.*.json', (route) => {
    const locale = route.request().url().includes('site.es.json') ? 'es' : 'en'
    if (contentMode === 'example') return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(buildStressContent(examples[locale], budgets)) })
  })
}

// Vite's own entry point, run with this Node: no shell, so killing the child
// stops the server on every platform.
function startPreview() {
  const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
  return spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    stdio: 'ignore',
  })
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(BASE)
      if (response.ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`vite preview did not answer on ${BASE}`)
}

// Runs in the page: every geometric assertion for the face on screen.
function measureFace({ queries }) {
  const failures = []
  const vw = window.innerWidth
  const vh = window.innerHeight
  const stacked = window.matchMedia(queries.stacked).matches
  const mode = stacked ? 'stacked' : window.matchMedia(queries.short).matches ? 'desktop-short' : 'desktop'
  const strip = document.querySelector('.cube-section-nav')?.getBoundingClientRect()

  // Name first: the page's single h1, in the top-left quarter, not covered.
  const headings = document.querySelectorAll('h1')
  const name = headings[0]
  if (headings.length !== 1 || !name || !name.textContent?.trim()) {
    failures.push('name-h1')
  } else {
    const box = name.getBoundingClientRect()
    if (box.left > vw / 2 || box.top > vh / 2) failures.push('name-position')
    // Hit-test with pointer events forced on, so layers that ignore the pointer
    // (the chrome, the scrims) still count as covering.
    const probe = document.createElement('style')
    probe.textContent = '* { pointer-events: auto !important; }'
    document.head.append(probe)
    const hit = document.elementFromPoint(box.left + Math.min(box.width, 40) / 2, box.top + box.height / 2)
    probe.remove()
    if (!hit || !name.contains(hit)) failures.push('name-covered')
  }

  const ctas = [...document.querySelectorAll('.side-panels__cta')]

  if (mode === 'stacked') {
    for (const [index, cta] of ctas.entries()) {
      cta.scrollIntoView({ block: 'center' })
      const box = cta.getBoundingClientRect()
      const stripNow = document.querySelector('.cube-section-nav')?.getBoundingClientRect()
      if (stripNow && box.bottom > stripNow.top + 1) failures.push(`cta-${index}-under-strip`)
    }
    return { mode, failures }
  }

  const warnings = []
  for (const [index, rail] of document.querySelectorAll('.side-panels__rail').entries()) {
    const side = index === 0 ? 'left' : 'right'
    const clips = getComputedStyle(rail).overflowY !== 'visible'
    // A clipping rail (the safety net) shows only its own box; otherwise any
    // descendant may paint past it.
    let bottom = rail.getBoundingClientRect().bottom - (clips ? parseFloat(getComputedStyle(rail).paddingBottom) : 0)
    if (!clips) {
      for (const element of rail.querySelectorAll('*')) {
        const box = element.getBoundingClientRect()
        if (box.width > 0 && box.height > 0) bottom = Math.max(bottom, box.bottom)
      }
    }
    if (strip && bottom > strip.top + 1) failures.push(`rail-${side}-over-strip`)
    if (rail.scrollHeight > rail.clientHeight + 1) warnings.push(`rail-${side}-scrolls`)
  }

  for (const [index, cta] of ctas.entries()) {
    const box = cta.getBoundingClientRect()
    if (box.top < 0 || box.left < 0 || box.bottom > vh || box.right > vw) failures.push(`cta-${index}-outside`)
    // Inside the viewport but scrolled out of its rail still means unseen.
    const rail = cta.closest('.side-panels__rail')
    const railBox = rail?.getBoundingClientRect()
    if (railBox && (box.bottom > railBox.bottom + 1 || box.top < railBox.top - 1)) failures.push(`cta-${index}-hidden-in-rail`)
  }

  return { mode, failures, warnings }
}

async function checkPage(browser, viewport, locale) {
  const [width, height] = viewport.split('x').map(Number)
  const context = await browser.newContext({ viewport: { width, height } })
  await serveContent(context)
  const page = await context.newPage()
  const results = { layout: [], axe: [] }
  await page.goto(`${BASE}/?intro=0&lang=${locale}`)
  await page.waitForSelector('.side-panels.is-idle', { timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  // The layout is measured with the served font (ADR 006, AD-10).
  if (!(await page.evaluate(() => document.fonts.check('16px "Inter Variable"')))) {
    results.layout.push(`${viewport} ${locale} font-not-loaded`)
  }

  // Accessibility of the landing face (the dialog and other faces share markup).
  const axe = await new AxeBuilder({ page }).analyze()
  for (const violation of axe.violations) results.axe.push(`${viewport} ${locale} ${violation.id}`)

  let mode = ''
  for (const face of FACES) {
    const current = await page.getAttribute('.side-panels', 'data-section')
    if (current !== face) {
      await page.click(`.cube-section-nav a[data-section-id="${face}"]`)
      await page.waitForSelector(`.side-panels.is-idle[data-section="${face}"]`, { timeout: 15000 })
    }
    const measured = await page.evaluate(measureFace, { queries: MODE_QUERIES })
    mode = measured.mode
    for (const failure of measured.failures) results.layout.push(`${viewport} ${locale} ${face} ${failure}`)
    for (const warning of measured.warnings ?? []) console.log(`  warning: ${viewport} ${locale} ${face} ${warning}`)
    await page.evaluate(() => window.scrollTo(0, 0))
  }

  await context.close()
  console.log(`  ${viewport} ${locale} (${mode}): ${results.layout.length} layout, ${results.axe.length} axe`)
  return results
}

// Degradation (spec 010, AD-09 and H-18): no visitor gets a blank page.
async function checkDegradation(browser) {
  const failures = []
  const errors = []

  // Without WebGL: the still image replaces the scene, the DOM stays.
  const noWebgl = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--disable-webgl', '--disable-webgl2'],
  })
  try {
    const page = await noWebgl.newPage({ viewport: { width: 1366, height: 768 } })
    page.on('pageerror', (error) => errors.push(`no-webgl: ${error.message}`))
    await page.goto(`${BASE}/?intro=1&lang=en`)
    await page.waitForSelector('.side-panels.is-idle', { timeout: 60000 })
    const state = await page.evaluate(() => {
      const poster = document.querySelector('.cube-canvas__poster')
      const visible = (selector) => {
        const element = document.querySelector(selector)
        const box = element?.getBoundingClientRect()
        return Boolean(box && box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden')
      }
      return {
        poster: Boolean(poster?.complete && poster.naturalWidth > 0),
        name: visible('h1'),
        rails: document.querySelectorAll('.side-panels__rail').length === 2 && visible('.side-panels__rail'),
        strip: visible('.cube-section-nav'),
        introDone: !document.querySelector('[data-intro]'),
      }
    })
    for (const [check, ok] of Object.entries(state)) if (!ok) failures.push(`degradation no-webgl ${check}`)
  } finally {
    await noWebgl.close()
  }

  // A world chunk that fails to load: that face loses its background, the
  // cube and the page stay.
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  try {
    const page = await context.newPage()
    // React Three Fiber reports errors through window.reportError even when a
    // boundary caught them, so a page error is expected here; what matters is
    // that the world's own boundary caught it and the page kept working.
    let caught = false
    page.on('console', (message) => {
      if (message.text().startsWith('World "products" failed')) caught = true
    })
    await page.route('**/assets/productsWorld-*.js', (route) => route.abort())
    await page.goto(`${BASE}/?intro=0&lang=en`)
    await page.waitForSelector('.side-panels.is-idle', { timeout: 60000 })
    await page.click('.cube-section-nav a[data-section-id="products"]')
    await page.waitForSelector('.side-panels.is-idle[data-section="products"]', { timeout: 15000 })
    await page.waitForTimeout(1500)
    const state = await page.evaluate(() => ({
      canvas: Boolean(document.querySelector('.cube-canvas canvas')),
      noPoster: !document.querySelector('.cube-canvas__poster'),
      name: Boolean(document.querySelector('h1')?.textContent),
    }))
    for (const [check, ok] of Object.entries({ ...state, caughtByWorldBoundary: caught })) {
      if (!ok) failures.push(`degradation world-fails ${check}`)
    }
  } finally {
    await context.close()
  }

  for (const error of errors) failures.push(`degradation page-error ${error.slice(0, 80)}`)
  console.log(`  degradation: ${failures.length} failures`)
  return failures
}

async function main() {
  const known = JSON.parse(readFileSync(KNOWN_PATH, 'utf8'))
  const preview = startPreview()
  let browser
  try {
    await waitForServer()
    browser = await chromium.launch({
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    })
    console.log(`Layout check on ${viewports.length} viewports × ${LOCALES.length} locales, content: ${contentMode}`)
    const found = { layout: [], axe: [] }
    for (const viewport of viewports) {
      for (const locale of LOCALES) {
        const results = await checkPage(browser, viewport, locale)
        found.layout.push(...results.layout)
        found.axe.push(...results.axe)
      }
    }

    if (contentMode === 'built') found.layout.push(...(await checkDegradation(browser)))

    if (args.has('--update-known') && contentMode !== 'built') {
      console.log('Known failures are recorded only for the built content.')
      process.exitCode = 1
      return
    }

    if (args.has('--update-known')) {
      // A blank page is never accepted as known debt.
      const degradation = found.layout.filter((id) => id.startsWith('degradation'))
      if (degradation.length > 0) {
        for (const id of degradation) console.log(`FAIL ${id}`)
        console.log('Degradation failures cannot be recorded as known.')
        process.exitCode = 1
        return
      }
      // Keep entries for viewports this run did not visit.
      const visited = (id) => viewports.includes(id.split(' ')[0])
      const merge = (previous, current) => [...new Set([...previous.filter((id) => !visited(id)), ...current])].sort()
      const next = { ...known, layout: merge(known.layout, found.layout), axe: merge(known.axe, found.axe) }
      writeFileSync(KNOWN_PATH, `${JSON.stringify(next, null, 2)}\n`)
      console.log(`Recorded ${next.layout.length} layout and ${next.axe.length} axe failures as known.`)
      return
    }

    let failed = false
    for (const kind of ['layout', 'axe']) {
      const knownSet = new Set(contentMode === 'built' ? known[kind] : [])
      const newFailures = found[kind].filter((id) => !knownSet.has(id))
      const fixed = [...knownSet].filter((id) => viewports.includes(id.split(' ')[0]) && !found[kind].includes(id))
      for (const id of newFailures) console.log(`NEW ${kind}: ${id}`)
      for (const id of fixed) console.log(`FIXED ${kind} (remove from the known list): ${id}`)
      if (newFailures.length > 0) failed = true
    }
    console.log(failed ? 'Layout check failed.' : 'Layout check passed (known failures only).')
    process.exitCode = failed ? 1 : 0
  } finally {
    await browser?.close()
    preview.kill()
  }
}

await main()
