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
//   node scripts/check-layout.mjs --full       full matrix (9 viewports)
//   node scripts/check-layout.mjs --update-known   record current failures as known
//   node scripts/check-layout.mjs --content=stress every field at its budget
//   node scripts/check-layout.mjs --content=example  the committed example
//
// Without --content the check uses what the build contains: the example in CI,
// the private content on the owner's machine (run it before publishing). With
// --content the documents are served by the check itself, and every failure
// fails: content that the admin accepts must always fit.
//
// Requires `npm run build` first. The layout pages run without WebGL: the
// geometry is DOM only and the still image takes the canvas's place, while a
// software-rendered scene can starve the page's main thread on a small CI
// runner. The scene itself is exercised by the degradation check, with WebGL
// in software (SwiftShader) so the result does not depend on the GPU.

import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildStressContent } from './checks/stressContent.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')
const { PNG } = require('pngjs')

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
  // Stress content points at owner media; any image stands in for it.
  const stand = readFileSync(fileURLToPath(new URL('../public/examples/project-1.webp', import.meta.url)))
  await context.route('**/content/media/*.webp', (route) => route.fulfill({ contentType: 'image/webp', body: stand }))
  await context.route('**/content/site.*.json', (route) => {
    const locale = route.request().url().includes('site.es.json') ? 'es' : 'en'
    if (contentMode === 'example') return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(buildStressContent(examples[locale], budgets)) })
  })
}

// Vite's own entry point, run with this Node: no shell, so killing the child
// stops the server on every platform.
// Content security policy: vite preview serves the production policy
// (infra/security-headers.json), enforced; any violation on any page fails.
const cspViolations = []
function watchCsp(page, where) {
  page.on('console', (message) => {
    const text = message.text()
    if (text.includes('Content Security Policy')) cspViolations.push(`csp ${where}: ${text.slice(0, 140)}`)
  })
}

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

// Contrast of the identity (AGENTS.md, Hard Rules: the name and role meet
// AA). axe cannot judge text over the cube's image and gradients, so the
// check hides the text, photographs exactly what lies behind it, takes the
// lightest background pixel (the worst case) and computes the WCAG ratio
// against the text colour composited over it.
const AA = 4.5

function channel(value) {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
function luminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

async function identityContrast(page) {
  const failures = []
  for (const [part, selector] of [['name', 'h1'], ['role', 'h1 + p']]) {
    const sample = await page.evaluate((selector) => {
      const element = document.querySelector(selector)
      if (!element) return null
      const box = element.getBoundingClientRect()
      // The computed colour may be oklab() or color-mix(): a 1x1 canvas turns
      // any CSS colour into RGBA.
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const context = canvas.getContext('2d')
      context.fillStyle = getComputedStyle(element).color
      context.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
      return { box: { x: box.x, y: box.y, width: box.width, height: box.height }, color: [r, g, b, a / 255] }
    }, selector)
    if (!sample) {
      failures.push(`contrast-${part}-missing`)
      continue
    }
    // Hide the text and its shadow, photograph the background, restore.
    await page.evaluate((selector) => {
      const element = document.querySelector(selector)
      element.style.setProperty('color', 'transparent', 'important')
      element.style.setProperty('text-shadow', 'none', 'important')
    }, selector)
    const png = PNG.sync.read(await page.screenshot({ clip: sample.box }))
    await page.evaluate((selector) => {
      const element = document.querySelector(selector)
      element.style.removeProperty('color')
      element.style.removeProperty('text-shadow')
    }, selector)

    let lightest = [0, 0, 0]
    for (let i = 0; i < png.data.length; i += 4) {
      const pixel = [png.data[i], png.data[i + 1], png.data[i + 2]]
      if (luminance(pixel) > luminance(lightest)) lightest = pixel
    }
    const [r, g, b, alpha] = sample.color
    const text = [r, g, b].map((value, index) => value * alpha + lightest[index] * (1 - alpha))
    const ratio = contrast(text, lightest)
    if (ratio < AA) failures.push(`contrast-${part} ${ratio.toFixed(2)}`)
  }
  return failures
}

// Runs in the page: every geometric assertion for the face on screen.
function measureFace({ queries }) {
  const failures = []
  const vw = window.innerWidth
  const vh = window.innerHeight
  const stacked = window.matchMedia(queries.stacked).matches
  const mode = stacked ? 'stacked' : window.matchMedia(queries.short).matches ? 'desktop-short' : 'desktop'
  const strip = document.querySelector('.face-strip')?.getBoundingClientRect()

  // Name first: the page's single h1, in the top-left quarter, not covered.
  const headings = document.querySelectorAll('h1')
  const name = headings[0]
  if (headings.length !== 1 || !name || !name.textContent?.trim()) {
    failures.push('name-h1')
  } else {
    const box = name.getBoundingClientRect()
    if (box.left > vw / 2 || box.top > vh / 2) failures.push('name-position')
    // Hit-test with pointer events forced on, so layers that ignore the pointer
    // (the chrome, the scrims) still count as covering. Through the CSSOM, not
    // an injected <style>: the content security policy blocks inline styles.
    const elements = [...document.querySelectorAll('*')]
    const saved = elements.map((element) => [element.style.getPropertyValue('pointer-events'), element.style.getPropertyPriority('pointer-events')])
    for (const element of elements) element.style.setProperty('pointer-events', 'auto', 'important')
    const hit = document.elementFromPoint(box.left + Math.min(box.width, 40) / 2, box.top + box.height / 2)
    elements.forEach((element, index) => {
      const [value, priority] = saved[index]
      if (value) element.style.setProperty('pointer-events', value, priority)
      else element.style.removeProperty('pointer-events')
    })
    if (!hit || !name.contains(hit)) failures.push('name-covered')
  }

  // Fixed chrome never overlaps (audit-2 B-23): the identity block, the
  // language toggle and the strip, against each other and against every
  // visible leaf of the rails.
  const visible = (element) => {
    const style = getComputedStyle(element)
    const box = element.getBoundingClientRect()
    return style.visibility !== 'hidden' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0
  }
  const overlaps = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
  // Containers may span the screen; what paints is their visible leaves.
  const leaves = (selector) =>
    [...document.querySelectorAll(`${selector} *`)].filter((element) => element.children.length === 0 && visible(element)).map((element) => element.getBoundingClientRect())
  const collide = (a, b) => a.some((boxA) => b.some((boxB) => overlaps(boxA, boxB)))
  const chrome = [
    ['identity', leaves('.identity-chrome')],
    ['language', leaves('.language-toggle')],
    ['strip', leaves('.face-strip')],
  ]
  for (const [index, [nameA, a]] of chrome.entries()) {
    for (const [nameB, b] of chrome.slice(index + 1)) if (collide(a, b)) failures.push(`chrome-${nameA}-over-${nameB}`)
  }
  // Stacked pages scroll under the fixed strip by design; their CTAs are
  // checked against it after scrolling (below).
  const rails = leaves('.face-rails__rail')
  for (const [name, boxes] of chrome) {
    if (mode === 'stacked' && name === 'strip') continue
    if (collide(boxes, rails)) failures.push(`chrome-${name}-over-rail`)
  }

  const ctas = [...document.querySelectorAll('.face-rails__cta')]

  if (mode === 'stacked') {
    for (const [index, cta] of ctas.entries()) {
      cta.scrollIntoView({ block: 'center' })
      const box = cta.getBoundingClientRect()
      const stripNow = document.querySelector('.face-strip')?.getBoundingClientRect()
      if (stripNow && box.bottom > stripNow.top + 1) failures.push(`cta-${index}-under-strip`)
    }
    return { mode, failures }
  }

  const warnings = []
  for (const [index, rail] of document.querySelectorAll('.face-rails__rail').entries()) {
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
    const rail = cta.closest('.face-rails__rail')
    const railBox = rail?.getBoundingClientRect()
    if (railBox && (box.bottom > railBox.bottom + 1 || box.top < railBox.top - 1)) failures.push(`cta-${index}-hidden-in-rail`)
  }

  return { mode, failures, warnings }
}

// Runs in the page: the stage (spec 011, desktop). Every block of the face's
// composition fits its area without scrolling, nothing it paints overlaps
// another block or the chrome, the centre stays clear for the cube (E-3), the
// calls to action are in view, and the name comes first.
function measureStage({ queries }) {
  const failures = []
  const vw = window.innerWidth
  const vh = window.innerHeight
  const mode = window.matchMedia(queries.short).matches ? 'desktop-short' : 'desktop'
  const visible = (element) => {
    const style = getComputedStyle(element)
    const box = element.getBoundingClientRect()
    return style.visibility !== 'hidden' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0
  }
  const overlaps = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
  const leafElements = (root) => [...root.querySelectorAll('*')].filter((element) => element.children.length === 0 && visible(element))
  const leaves = (selector) => [...document.querySelectorAll(selector)].flatMap((root) => leafElements(root).map((element) => element.getBoundingClientRect()))
  const collide = (a, b) => a.some((boxA) => b.some((boxB) => overlaps(boxA, boxB)))

  // Name first: the page's single h1, in the top-left quarter.
  const headings = document.querySelectorAll('h1')
  const name = headings[0]
  if (headings.length !== 1 || !name?.textContent?.trim()) failures.push('name-h1')
  else {
    const box = name.getBoundingClientRect()
    if (box.left > vw / 2 || box.top > vh / 2) failures.push('name-position')
  }

  const content = leaves('.stage-content')
  const top = leaves('.stage-top')
  const dock = leaves('.stage-dock')
  if (collide(top, dock)) failures.push('chrome-top-over-dock')
  if (collide(top, content)) failures.push('chrome-top-over-content')
  if (collide(dock, content)) failures.push('chrome-dock-over-content')

  const blocks = [...document.querySelectorAll('.stage-content > *')].filter(visible)
  for (const [index, block] of blocks.entries()) {
    const box = block.getBoundingClientRect()
    if (box.top < 0 || box.left < 0 || box.bottom > vh || box.right > vw) failures.push(`block-${index}-outside`)
    // A block holds its content: no scroll inside, no descendant painting past it.
    if (block.scrollHeight > block.clientHeight + 1) failures.push(`block-${index}-overflows`)
    else {
      for (const leaf of leafElements(block)) {
        const leafBox = leaf.getBoundingClientRect()
        if (leafBox.bottom > box.bottom + 1 || leafBox.right > box.right + 1) {
          failures.push(`block-${index}-spills`)
          break
        }
      }
    }
    for (const [other, otherBlock] of blocks.entries()) {
      if (other > index && overlaps(box, otherBlock.getBoundingClientRect())) failures.push(`block-${index}-over-block-${other}`)
    }
    // Inside a block, no text or image is painted over another.
    const own = leafElements(block)
      .filter((element) => !element.closest('svg') && getComputedStyle(element).position !== 'absolute')
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
    search: for (const [a, first] of own.entries()) {
      for (const second of own.slice(a + 1)) {
        if (first.element.contains(second.element) || second.element.contains(first.element)) continue
        if (overlaps(first.box, second.box)) {
          failures.push(`block-${index}-overlapping-content`)
          break search
        }
      }
    }
  }

  // The cube waits at the centre of the screen (E-3: it never disappears).
  const centre = { left: vw * 0.44, right: vw * 0.56, top: vh * 0.36, bottom: vh * 0.6 }
  if (content.some((box) => overlaps(box, centre))) failures.push('cube-covered')

  for (const [index, cta] of document.querySelectorAll('.stage-content .st-button').entries()) {
    const box = cta.getBoundingClientRect()
    if (box.top < 0 || box.left < 0 || box.bottom > vh || box.right > vw) failures.push(`cta-${index}-outside`)
    const holder = cta.closest('.stage-content > *')?.getBoundingClientRect()
    if (holder && (box.bottom > holder.bottom + 1 || box.top < holder.top - 1)) failures.push(`cta-${index}-hidden-in-block`)
  }
  return { mode, failures }
}

// On an unexpected error the page's own errors and a screenshot go to
// layout-report/ (uploaded by CI), so a failure there can be read, not guessed.
const REPORT_DIR = fileURLToPath(new URL('../layout-report/', import.meta.url))

async function checkPage(browser, viewport, locale) {
  const [width, height] = viewport.split('x').map(Number)
  const context = await browser.newContext({ viewport: { width, height } })
  await serveContent(context)
  const page = await context.newPage()
  watchCsp(page, `${viewport} ${locale}`)
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(`pageerror: ${error.message}`))
  page.on('crash', () => pageErrors.push('crash: the page process crashed'))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') pageErrors.push(`${message.type()}: ${message.text().slice(0, 300)}`)
  })
  try {
    return await measurePage(page, viewport, locale)
  } catch (error) {
    mkdirSync(REPORT_DIR, { recursive: true })
    const name = `${viewport}-${locale}`
    await page.screenshot({ path: `${REPORT_DIR}${name}.png` }).catch(() => undefined)
    writeFileSync(`${REPORT_DIR}${name}.log`, [String(error), '', ...pageErrors].join('\n'))
    console.log(`  ${viewport} ${locale}: unexpected error, see layout-report/${name}.log`)
    for (const line of pageErrors.slice(-8)) console.log(`    ${line}`)
    throw error
  } finally {
    await context.close()
  }
}

async function measurePage(page, viewport, locale) {
  const results = { layout: [], axe: [] }
  await page.goto(`${BASE}/?intro=0&lang=${locale}`)
  await page.waitForSelector('.face-rails[data-transition="idle"], .stage[data-transition="idle"]', { timeout: 60000 })
  // Desktop shows the stage (spec 011), stacked screens the rails.
  const stage = (await page.$('.stage')) !== null
  await page.evaluate(() => document.fonts.ready)
  // The layout is measured with the served font (ADR 006, AD-10).
  if (!(await page.evaluate(() => document.fonts.check('16px "Inter Variable"')))) {
    results.layout.push(`${viewport} ${locale} font-not-loaded`)
  }

  for (const failure of await identityContrast(page)) results.layout.push(`${viewport} ${locale} ${failure}`)

  // Accessibility of the landing face (the dialog and other faces share markup).
  const axe = await new AxeBuilder({ page }).analyze()
  for (const violation of axe.violations) results.axe.push(`${viewport} ${locale} ${violation.id}`)

  let mode = ''
  for (const face of FACES) {
    if (stage) {
      if ((await page.getAttribute('.stage', 'data-face')) !== face) {
        await page.click(`.stage-dock a[data-section-id="${face}"]`)
        await page.waitForSelector(`.stage[data-transition="idle"][data-face="${face}"]`, { timeout: 15000 })
      }
      // The blocks rise in order; measure them where they rest.
      await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().map((animation) => animation.finished)), new Promise((resolve) => setTimeout(resolve, 3000))]))
    } else if ((await page.getAttribute('.face-rails', 'data-section')) !== face) {
      await page.click(`.face-strip a[data-section-id="${face}"]`)
      await page.waitForSelector(`.face-rails[data-transition="idle"][data-section="${face}"]`, { timeout: 15000 })
    }
    const measured = await page.evaluate(stage ? measureStage : measureFace, { queries: MODE_QUERIES })
    mode = measured.mode
    for (const failure of measured.failures) results.layout.push(`${viewport} ${locale} ${face} ${failure}`)
    for (const warning of measured.warnings ?? []) console.log(`  warning: ${viewport} ${locale} ${face} ${warning}`)
    await page.evaluate(() => window.scrollTo(0, 0))
  }

  console.log(`  ${viewport} ${locale} (${mode}): ${results.layout.length} layout, ${results.axe.length} axe`)
  return results
}

const launch = (args) => chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args })
const NO_WEBGL = ['--disable-webgl', '--disable-webgl2']
const SOFTWARE_WEBGL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']

// Degradation (spec 010, AD-09 and H-18): no visitor gets a blank page.
async function checkDegradation(noWebglBrowser) {
  const failures = []
  const errors = []

  // Without WebGL: the still image replaces the scene, the DOM stays.
  const noWebglContext = await noWebglBrowser.newContext({ viewport: { width: 1366, height: 768 } })
  try {
    const page = await noWebglContext.newPage()
    watchCsp(page, 'degradation no-webgl')
    page.on('pageerror', (error) => errors.push(`no-webgl: ${error.message}`))
    await page.goto(`${BASE}/?intro=1&lang=en`)
    await page.waitForSelector('.stage[data-transition="idle"]', { timeout: 60000 })
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
        content: visible('.stage-content > *'),
        dock: visible('.stage-dock'),
        introDone: !document.querySelector('[data-intro]'),
      }
    })
    for (const [check, ok] of Object.entries(state)) if (!ok) failures.push(`degradation no-webgl ${check}`)
  } finally {
    await noWebglContext.close()
  }

  // With the scene: it mounts, and a world chunk that fails to load leaves its
  // face without background while the cube and the page stay. Software WebGL
  // is slow on a CI runner, hence the generous timeouts.
  const webglBrowser = await launch(SOFTWARE_WEBGL)
  const context = await webglBrowser.newContext({ viewport: { width: 1366, height: 768 } })
  context.setDefaultTimeout(120000)
  try {
    const page = await context.newPage()
    watchCsp(page, 'degradation world')
    // React Three Fiber reports errors through window.reportError even when a
    // boundary caught them, so a page error is expected here; what matters is
    // that the world's own boundary caught it and the page kept working.
    let caught = false
    page.on('console', (message) => {
      if (message.text().startsWith('World "products" failed')) caught = true
    })
    await page.route('**/assets/productsWorld-*.js', (route) => route.abort())
    await page.goto(`${BASE}/?intro=0&lang=en`)
    await page.waitForSelector('.stage[data-transition="idle"]')
    await page.click('.stage-dock a[data-section-id="products"]')
    await page.waitForSelector('.stage[data-transition="idle"][data-face="products"]')
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
    await webglBrowser.close()
  }

  for (const error of errors) failures.push(`degradation page-error ${error.slice(0, 80)}`)
  console.log(`  degradation: ${failures.length} failures`)
  return failures
}

// Behaviour (spec 010, P3 exit criteria): the detail dialog's keyboard and
// focus contract, and the first-visit intro handing over to the interface.
// Run without WebGL except the intro, which needs the scene to land.
async function checkBehaviour(noWebglBrowser) {
  const failures = []
  const fail = (id) => failures.push(`behaviour ${id}`)

  const context = await noWebglBrowser.newContext({ viewport: { width: 1440, height: 900 } })
  try {
    const page = await context.newPage()
    watchCsp(page, 'behaviour dialog')
    await page.goto(`${BASE}/?intro=0&lang=en&section=agentic`)
    await page.waitForSelector('.stage[data-transition="idle"]', { timeout: 60000 })
    // A call to action without a target opens the face's detail.
    const trigger = page.locator('.stage-content button.st-button').first()
    await trigger.focus()
    await page.keyboard.press('Enter')
    await page.waitForSelector('dialog[open]', { timeout: 5000 })

    const opened = await page.evaluate(() => {
      const dialog = document.querySelector('dialog[open]')
      // The page behind a modal dialog is inert: a control there cannot take focus.
      const behind = document.querySelector('.stage-dock a')
      behind?.focus()
      const backgroundInert = Boolean(behind) && document.activeElement !== behind
      dialog?.querySelector('h2')?.focus()
      return {
        modal: dialog?.matches(':modal') ?? false,
        titleFocused: document.activeElement === document.getElementById(dialog?.getAttribute('aria-labelledby') ?? ''),
        backgroundInert,
        scrollLocked: document.documentElement.style.overflow === 'hidden',
      }
    })
    for (const [check, ok] of Object.entries(opened)) if (!ok) fail(`dialog-open ${check}`)

    // Tab and Shift+Tab stay inside the dialog.
    for (const keys of [['Tab'], ['Tab'], ['Shift+Tab'], ['Shift+Tab']]) {
      await page.keyboard.press(keys[0])
      const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]')))
      if (!inside) {
        fail(`dialog-focus-escapes ${keys[0]}`)
        break
      }
    }

    await page.keyboard.press('Escape')
    await page.waitForSelector('dialog[open]', { state: 'detached', timeout: 5000 }).catch(() => fail('dialog-escape'))
    const closed = await page.evaluate(() => ({
      focusReturned: document.activeElement?.classList.contains('st-button') ?? false,
      backgroundRestored: !document.querySelector('main [inert]'),
      scrollRestored: document.documentElement.style.overflow !== 'hidden',
    }))
    for (const [check, ok] of Object.entries(closed)) if (!ok) fail(`dialog-close ${check}`)
  } finally {
    await context.close()
  }

  // The intro hides the interface while the cube falls, then hands over; any
  // key skips it at once.
  const webglBrowser = await launch(SOFTWARE_WEBGL)
  const webglContext = await webglBrowser.newContext({ viewport: { width: 1366, height: 768 } })
  webglContext.setDefaultTimeout(120000)
  try {
    const page = await webglContext.newPage()
    watchCsp(page, 'behaviour intro')
    await page.goto(`${BASE}/?intro=1&lang=en`)
    const pending = await page.waitForSelector('[data-intro="pending"]', { timeout: 30000 }).then(() => true).catch(() => false)
    if (!pending) fail('intro-not-pending')
    // The choreography hooks (intro.css) must reach every piece it hides.
    const shown = await page.evaluate(() =>
      ['.stage-top', '.stage-content', '.stage-dock'].filter((selector) => {
        const element = document.querySelector(selector)
        return !element || getComputedStyle(element).visibility !== 'hidden'
      }),
    )
    for (const selector of shown) fail(`intro-pending-shows ${selector}`)
    await page.keyboard.press('Space')
    const skipped = await page.waitForFunction(() => !document.querySelector('[data-intro]'), null, { timeout: 8000 }).then(() => true).catch(() => false)
    if (!skipped) fail('intro-skip')
    const visible = await page.evaluate(() => getComputedStyle(document.querySelector('.stage-content')).visibility !== 'hidden')
    if (!visible) fail('intro-content-hidden-after-skip')
  } finally {
    await webglBrowser.close()
  }

  console.log(`  behaviour: ${failures.length} failures`)
  return failures
}

async function main() {
  const known = JSON.parse(readFileSync(KNOWN_PATH, 'utf8'))
  const preview = startPreview()
  let browser
  try {
    await waitForServer()
    browser = await launch(NO_WEBGL)
    console.log(`Layout check on ${viewports.length} viewports × ${LOCALES.length} locales, content: ${contentMode}`)
    const found = { layout: [], axe: [] }
    for (const viewport of viewports) {
      for (const locale of LOCALES) {
        const results = await checkPage(browser, viewport, locale)
        found.layout.push(...results.layout)
        found.axe.push(...results.axe)
      }
    }

    if (contentMode === 'built') {
      found.layout.push(...(await checkDegradation(browser)))
      found.layout.push(...(await checkBehaviour(browser)))
    }
    found.layout.push(...cspViolations)

    if (args.has('--update-known') && contentMode !== 'built') {
      console.log('Known failures are recorded only for the built content.')
      process.exitCode = 1
      return
    }

    if (args.has('--update-known')) {
      // A blank page is never accepted as known debt.
      const degradation = found.layout.filter((id) => /^(degradation|behaviour|csp) /.test(id))
      if (degradation.length > 0) {
        for (const id of degradation) console.log(`FAIL ${id}`)
        console.log('Degradation and behaviour failures cannot be recorded as known.')
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
