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
//
// Requires `npm run build` first. WebGL runs in software (SwiftShader) so the
// result does not depend on the machine's GPU.

import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')

const KNOWN_PATH = fileURLToPath(new URL('./checks/layout-known.json', import.meta.url))
const PORT = 4179
const BASE = `http://127.0.0.1:${PORT}`

const PR_VIEWPORTS = ['1600x725', '1366x768', '390x844']
const FULL_VIEWPORTS = ['2048x1152', '1920x1080', '1600x725', '1440x900', '1366x768', '1280x720', '768x1024', '390x844']
const LOCALES = ['en', 'es']
const FACES = ['agentic', 'products', 'systems', 'security', 'research', 'contact']

// Until src/styles/layoutModes.ts exists (P2a) the queries are mirrored here.
const MODE_QUERIES = {
  stacked: '(max-width: 900px), (max-aspect-ratio: 4/3)',
  short: '(max-height: 820px)',
}

const args = new Set(process.argv.slice(2))
const viewports = args.has('--full') ? FULL_VIEWPORTS : PR_VIEWPORTS

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

  for (const [index, rail] of document.querySelectorAll('.side-panels__rail').entries()) {
    let bottom = rail.getBoundingClientRect().bottom
    for (const element of rail.querySelectorAll('*')) {
      const box = element.getBoundingClientRect()
      if (box.width > 0 && box.height > 0) bottom = Math.max(bottom, box.bottom)
    }
    if (strip && bottom > strip.top + 1) failures.push(`rail-${index === 0 ? 'left' : 'right'}-over-strip`)
  }

  for (const [index, cta] of ctas.entries()) {
    const box = cta.getBoundingClientRect()
    if (box.top < 0 || box.left < 0 || box.bottom > vh || box.right > vw) failures.push(`cta-${index}-outside`)
  }

  return { mode, failures }
}

async function checkPage(browser, viewport, locale) {
  const [width, height] = viewport.split('x').map(Number)
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const results = { layout: [], axe: [] }
  await page.goto(`${BASE}/?intro=0&lang=${locale}`)
  await page.waitForSelector('.side-panels.is-idle', { timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)

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
    await page.evaluate(() => window.scrollTo(0, 0))
  }

  await context.close()
  console.log(`  ${viewport} ${locale} (${mode}): ${results.layout.length} layout, ${results.axe.length} axe`)
  return results
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
    console.log(`Layout check on ${viewports.length} viewports × ${LOCALES.length} locales`)
    const found = { layout: [], axe: [] }
    for (const viewport of viewports) {
      for (const locale of LOCALES) {
        const results = await checkPage(browser, viewport, locale)
        found.layout.push(...results.layout)
        found.axe.push(...results.axe)
      }
    }

    if (args.has('--update-known')) {
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
      const knownSet = new Set(known[kind])
      const newFailures = found[kind].filter((id) => !knownSet.has(id))
      const fixed = known[kind].filter((id) => viewports.includes(id.split(' ')[0]) && !found[kind].includes(id))
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
