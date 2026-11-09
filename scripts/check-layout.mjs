// Layout and accessibility check (spec 010, H-06 and H-13).
//
// Serves the built site with `vite preview`, opens one page per viewport and
// locale, walks the six faces by clicking the face strip and asserts DOM
// geometry (no pixel diffs). Each failure has a stable id; the ids recorded in
// scripts/checks/layout-known.json are known debt and do not fail the run, any
// other id does. A known id that no longer fails is reported so the list only
// shrinks.
//
//   node scripts/check-layout.mjs              default matrix (4 viewports, every layout mode)
//   node scripts/check-layout.mjs --full       full matrix (9 viewports)
//   --out-dir=<private build> --require-complete-content checks a fixed owner
//   snapshot and refuses acceptance while examples or publish warnings remain.
//   node scripts/check-layout.mjs --worlds     also the contrast over every world
//   node scripts/check-layout.mjs --update-known   record current failures as known
//   node scripts/check-layout.mjs --content=stress every field at its budget, and
//                                                  again without the optional blocks
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
// runner. The scene itself is exercised by the degradation check and, with
// --worlds, by the contrast of the name over every world, with WebGL in
// software (SwiftShader) so the result does not depend on the GPU. --worlds is
// on demand while the site is being built (2026-10-16): it took 30 to 36
// minutes of a 40-minute CI run. Run it when a world, the top bar or its veil
// changes, and before a stage's acceptance.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
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
const reviewBuild = process.argv.find(arg => arg.startsWith('--out-dir='))?.slice('--out-dir='.length)
const buildArgs = reviewBuild ? ['--outDir', reviewBuild] : []
const manifestPath = join(resolve(reviewBuild ?? 'dist'), 'review-manifest.json')
const reviewManifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
if (reviewManifest) {
  const ids = ['site.en', 'site.es', 'visual', 'profile.en', 'profile.es']
  if (ids.some(id => !reviewManifest.documents?.[id]?.sha256)) throw new Error('Incomplete review manifest')
  for (const id of ids) {
    const document = reviewManifest.documents[id]
    const data = readFileSync(join(resolve(reviewBuild ?? 'dist'), 'content', `${id}.json`))
    const hash = createHash('sha256').update(data).digest('hex')
    if (hash !== document.sha256) throw new Error(`Review input mismatch: ${id}`)
    if (id.startsWith('site.')) {
      const content = JSON.parse(data)
      if (!Array.isArray(content.sections) || content.sections.length !== 6 || new Set(content.sections.map(section => section.id)).size !== 6) throw new Error(`Invalid review sections: ${id}`)
      const example = JSON.parse(readFileSync(new URL(`../public/content/site.example.${id.slice(5)}.json`, import.meta.url), 'utf8'))
      reviewManifest.faces[id] = content.sections.map(section => {
        const sameExample = canonical(section.composition) === canonical(example.sections.find(face => face.id === section.id)?.composition)
        const fallbackFields = ['eyebrow', 'ctaPrimary', 'ctaSecondary', 'detail', 'tagline', 'composition'].filter(field => section[field] == null)
        return { id: section.id, ownComposition: Boolean(section.composition) && !sameExample, template: section.composition?.template ?? null, exampleFallback: !section.composition || sameExample, fallbackFields }
      })
    }
  }
}

// The default matrix renders every layout mode (audit-3 F-2: until 2026-10-16
// no default viewport was taller than 900px, so `desktop` was only ever
// checked at night): 1920×1080 is desktop, 1600×725 and 1366×768 are
// desktop-short, 390×844 is stacked. A run that misses a mode fails.
const PR_VIEWPORTS = ['1920x1080', '1600x725', '1366x768', '390x844']
const FULL_VIEWPORTS = ['2048x1152', '1920x1080', '1600x725', '1536x864', '1440x900', '1366x768', '1280x720', '768x1024', '390x844']
const LAYOUT_MODES = ['stacked', 'desktop', 'desktop-short']
const LOCALES = ['en', 'es']
const FACES = ['agentic', 'products', 'systems', 'security', 'research', 'contact']
// The pages the checks open (src/kernel/sitePaths.ts): each language's cube
// page and its AGENTIC page. The address check proves the site answers on
// them and keeps the address bar in step with what it shows.
const ROOT = { en: '/', es: '/es' }
const AGENTIC = { en: '/agentic', es: '/es/agentico' }
// The bare address follows the browser's language, so every page opens as
// an English or a Spanish visitor's browser would, whatever the machine's.
const BROWSER_LOCALE = { en: 'en-US', es: 'es-CL' }

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

// Serves the site documents for --content=stress|example. The stress content
// is served twice: every slot at its budget, then without the optional blocks
// (audit-3 F-6), the other shape the admin accepts.
let stressBare = false
async function serveContent(context) {
  if (contentMode === 'built') return
  // Stress content points at owner media; any image stands in for it.
  const stand = readFileSync(fileURLToPath(new URL('../public/examples/project-1.webp', import.meta.url)))
  await context.route('**/content/media/*.webp', (route) => route.fulfill({ contentType: 'image/webp', body: stand }))
  await context.route('**/content/site.*.json', (route) => {
    const locale = route.request().url().includes('site.es.json') ? 'es' : 'en'
    if (contentMode === 'example') return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(buildStressContent(examples[locale], budgets, { bare: stressBare })) })
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
  return spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1', ...buildArgs], {
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

// The WCAG ratio of the name and of the role over what lies behind them; null
// when the element is missing.
async function identityRatios(page) {
  const ratios = {}
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
      ratios[part] = null
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
    ratios[part] = contrast(text, lightest)
  }
  return ratios
}

const contrastFailures = (ratios) =>
  Object.entries(ratios).flatMap(([part, ratio]) => (ratio === null ? [`contrast-${part}-missing`] : ratio < AA ? [`contrast-${part} ${ratio.toFixed(2)}`] : []))

async function identityContrast(page) {
  return contrastFailures(await identityRatios(page))
}

// Runs in the page: the stage (spec 011) for the face on screen. Every block
// of the composition fits its area without scrolling, nothing it paints
// overlaps another block, the chrome or itself, and the name comes first.
// Desktop: the centre stays clear for the cube (E-3) and the calls to action
// are in view. Stacked (the hero): the composition starts below the cube, the
// page never scrolls sideways, and every call to action can be scrolled clear
// of the fixed dock.
function measureStage({ queries }) {
  const failures = []
  const vw = window.innerWidth
  const vh = window.innerHeight
  const stacked = window.matchMedia(queries.stacked).matches
  const mode = stacked ? 'stacked' : window.matchMedia(queries.short).matches ? 'desktop-short' : 'desktop'
  const visible = (element) => {
    const style = getComputedStyle(element)
    const box = element.getBoundingClientRect()
    return style.visibility !== 'hidden' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0
  }
  const overlaps = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
  const leafElements = (root) => [...root.querySelectorAll('*')].filter((element) => element.children.length === 0 && visible(element))
  const leaves = (selector) => [...document.querySelectorAll(selector)].flatMap((root) => leafElements(root).map((element) => element.getBoundingClientRect()))
  const collide = (a, b) => a.some((boxA) => b.some((boxB) => overlaps(boxA, boxB)))

  // Name first: the page's single h1, in the top-left quarter, not covered.
  const headings = document.querySelectorAll('h1')
  const name = headings[0]
  if (headings.length !== 1 || !name?.textContent?.trim()) failures.push('name-h1')
  else {
    const box = name.getBoundingClientRect()
    if (box.left > vw / 2 || box.top > vh / 2) failures.push('name-position')
    // Hit-test with pointer events forced on, so layers that ignore the pointer
    // (the stage, the veils) still count as covering. Through the CSSOM, not an
    // injected <style>: the content security policy blocks inline styles.
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

  const content = leaves('.stage-content')
  const top = leaves('.stage-top')
  const dock = leaves('.stage-dock')
  if (collide(top, dock)) failures.push('chrome-top-over-dock')
  if (collide(top, content)) failures.push('chrome-top-over-content')
  // Stacked pages scroll under the fixed dock by design; checked below.
  if (!stacked && collide(dock, content)) failures.push('chrome-dock-over-content')
  if (document.documentElement.scrollWidth > vw + 1) failures.push('page-scrolls-sideways')
  // The dock names its six faces in full (design review, 2026-10-21): each
  // label stays inside its item, the longest the admin accepts included
  // (--content=stress). An ellipsis would hide the cut, so none is allowed.
  for (const item of document.querySelectorAll('.stage-dock__item')) {
    const label = item.querySelector('strong')
    if (!label || !visible(item)) continue
    const range = document.createRange()
    range.selectNodeContents(label)
    const text = range.getBoundingClientRect()
    const edge = item.getBoundingClientRect().right - parseFloat(getComputedStyle(item).paddingRight)
    if (text.right > edge + 1 || label.scrollWidth > label.clientWidth + 1) failures.push(`dock-label-cut-${item.dataset.sectionId}`)
  }

  const blocks = [...document.querySelectorAll('.stage-content > *')].filter(visible)
  for (const [index, block] of blocks.entries()) {
    const box = block.getBoundingClientRect()
    const outside = stacked ? box.left < 0 || box.right > vw : box.top < 0 || box.left < 0 || box.bottom > vh || box.right > vw
    if (outside) failures.push(`block-${index}-outside`)
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
    // A word too long for its box is painted past it, though the box does
    // not grow: no overlap of boxes shows it (a control's id, 2026-10-20).
    // Text cut on purpose, with an ellipsis, is not counted.
    if (own.some(({ element }) => element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0 && getComputedStyle(element).textOverflow !== 'ellipsis')) {
      failures.push(`block-${index}-text-past-its-box`)
    }
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

  const ctas = [...document.querySelectorAll('.stage-content .st-button')]
  if (stacked) {
    // The cube is the hero: the composition begins below its box.
    const hero = document.querySelector('.cube-canvas')?.getBoundingClientRect()
    if (hero && content.some((box) => box.top < hero.bottom - 1)) failures.push('cube-covered')
    for (const [index, cta] of ctas.entries()) {
      cta.scrollIntoView({ block: 'center' })
      const box = cta.getBoundingClientRect()
      const dockNow = document.querySelector('.stage-dock')?.getBoundingClientRect()
      if (dockNow && box.bottom > dockNow.top + 1) failures.push(`cta-${index}-under-dock`)
    }
    // The end of the page can be scrolled clear of the dock.
    window.scrollTo(0, document.documentElement.scrollHeight)
    const last = Math.max(...leaves('.stage-content').map((box) => box.bottom))
    const dockNow = document.querySelector('.stage-dock')?.getBoundingClientRect()
    if (dockNow && last > dockNow.top + 1) failures.push('content-end-under-dock')
    window.scrollTo(0, 0)
    return { mode, failures }
  }

  // The cube waits at the centre of the screen (E-3: it never disappears).
  const centre = { left: vw * 0.44, right: vw * 0.56, top: vh * 0.36, bottom: vh * 0.6 }
  if (content.some((box) => overlaps(box, centre))) failures.push('cube-covered')

  for (const [index, cta] of ctas.entries()) {
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

async function checkPage(browser, viewport, locale, variant = '') {
  const [width, height] = viewport.split('x').map(Number)
  const context = await browser.newContext({ viewport: { width, height }, locale: BROWSER_LOCALE[locale] })
  await serveContent(context)
  const page = await context.newPage()
  watchCsp(page, [viewport, locale, variant].filter(Boolean).join(' '))
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(`pageerror: ${error.message}`))
  page.on('crash', () => pageErrors.push('crash: the page process crashed'))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') pageErrors.push(`${message.type()}: ${message.text().slice(0, 300)}`)
  })
  try {
    return await measurePage(page, viewport, locale, variant)
  } catch (error) {
    mkdirSync(REPORT_DIR, { recursive: true })
    const name = [viewport, locale, variant].filter(Boolean).join('-')
    await page.screenshot({ path: `${REPORT_DIR}${name}.png` }).catch(() => undefined)
    writeFileSync(`${REPORT_DIR}${name}.log`, [String(error), '', ...pageErrors].join('\n'))
    console.log(`  ${viewport} ${locale}: unexpected error, see layout-report/${name}.log`)
    for (const line of pageErrors.slice(-8)) console.log(`    ${line}`)
    throw error
  } finally {
    await context.close()
  }
}

async function measurePage(page, viewport, locale, variant = '') {
  const results = { layout: [], axe: [] }
  // Failure ids start with the viewport (the known list is keyed by it); a
  // stress variant is named after the locale.
  const where = [viewport, locale, variant].filter(Boolean).join(' ')
  await page.goto(`${BASE}${ROOT[locale]}?intro=0`)
  await page.waitForSelector('.stage[data-transition="idle"]', { timeout: 60000 })
  // Each language is measured in that language, never the other one twice.
  if ((await page.evaluate(() => document.documentElement.lang)) !== locale) results.layout.push(`${where} wrong-language`)
  await page.evaluate(() => document.fonts.ready)
  // The layout is measured with the served font (ADR 006, AD-10).
  if (!(await page.evaluate(() => document.fonts.check('16px "Inter Variable"')))) {
    results.layout.push(`${where} font-not-loaded`)
  }

  for (const failure of await identityContrast(page)) results.layout.push(`${where} ${failure}`)

  // Accessibility of the landing face (the dialog and other faces share markup).
  const axe = await new AxeBuilder({ page }).analyze()
  for (const violation of axe.violations) results.axe.push(`${where} ${violation.id}`)

  let mode = ''
  for (const face of FACES) {
    if ((await page.getAttribute('.stage', 'data-face')) !== face) {
      await page.click(`.stage-dock a[data-section-id="${face}"]`)
      await page.waitForSelector(`.stage[data-transition="idle"][data-face="${face}"]`, { timeout: 15000 })
    }
    // The blocks rise in order; measure them where they rest.
    await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().map((animation) => animation.finished)), new Promise((resolve) => setTimeout(resolve, 3000))]))
    const measured = await page.evaluate(measureStage, { queries: MODE_QUERIES })
    mode = measured.mode
    for (const failure of measured.failures) results.layout.push(`${where} ${face} ${failure}`)
    for (const warning of measured.warnings ?? []) console.log(`  warning: ${where} ${face} ${warning}`)
    await page.evaluate(() => window.scrollTo(0, 0))
  }

  console.log(`  ${where} (${mode}): ${results.layout.length} layout, ${results.axe.length} axe`)
  return { ...results, mode }
}

const launch = (args) => chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args })
const NO_WEBGL = ['--disable-webgl', '--disable-webgl2']
const SOFTWARE_WEBGL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']

// Degradation (spec 010, AD-09 and H-18): no visitor gets a blank page.
async function checkDegradation(noWebglBrowser) {
  const failures = []
  const errors = []

  // Without WebGL: the still image replaces the scene, the DOM stays.
  const noWebglContext = await noWebglBrowser.newContext({ viewport: { width: 1366, height: 768 }, locale: BROWSER_LOCALE.en })
  try {
    const page = await noWebglContext.newPage()
    watchCsp(page, 'degradation no-webgl')
    page.on('pageerror', (error) => errors.push(`no-webgl: ${error.message}`))
    await page.goto(`${BASE}/?intro=1`)
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
  const context = await webglBrowser.newContext({ viewport: { width: 1366, height: 768 }, locale: BROWSER_LOCALE.en })
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
    await page.goto(`${BASE}${AGENTIC.en}?intro=0`)
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

// Contrast over the worlds (spec 011, S5). The layout pages run without WebGL,
// so their contrast is measured over the still image. Here the scene runs
// (software WebGL) and the name and the role are measured over every face's
// world, on the stage and on the phone's hero, in three frames: the worlds
// move, and the worst frame counts. On the stage, again in cube mode, where
// the veil is gone. Only with --worlds.
const WORLD_VIEWPORTS = ['1366x768', '390x844']
async function checkWorldContrast() {
  const failures = []
  const browser = await launch(SOFTWARE_WEBGL)
  try {
    for (const viewport of WORLD_VIEWPORTS) {
      const [width, height] = viewport.split('x').map(Number)
      for (const locale of LOCALES) {
        const context = await browser.newContext({ viewport: { width, height }, locale: BROWSER_LOCALE[locale] })
        context.setDefaultTimeout(120000)
        try {
          const page = await context.newPage()
          watchCsp(page, `worlds ${viewport} ${locale}`)
          await page.goto(`${BASE}${AGENTIC[locale]}?intro=0`)
          await page.waitForSelector('.stage[data-transition="idle"]')
          const measure = async (where, firstWait) => {
            const worst = {}
            for (let frame = 0; frame < 3; frame += 1) {
              await page.waitForTimeout(frame === 0 ? firstWait : 800)
              for (const [part, ratio] of Object.entries(await identityRatios(page))) {
                worst[part] = ratio === null || worst[part] === null ? null : Math.min(ratio, worst[part] ?? Infinity)
              }
            }
            for (const failure of contrastFailures(worst)) failures.push(`worlds ${viewport} ${locale} ${where} ${failure}`)
          }
          for (const face of FACES) {
            if ((await page.getAttribute('.stage', 'data-face')) !== face) {
              await page.click(`.stage-dock a[data-section-id="${face}"]`)
              await page.waitForSelector(`.stage[data-transition="idle"][data-face="${face}"]`)
            }
            // The hero scrolls the composition into view; the world is behind the top.
            await page.evaluate(() => window.scrollTo(0, 0))
            // The first wait lets the face's world compile and appear.
            await measure(face, 3000)
            if (width >= 720) {
              await page.click('.stage-explore')
              await page.waitForSelector('.stage[data-explore]')
              await measure(`${face} cube-mode`, 1200)
              await page.keyboard.press('Escape')
              await page.waitForSelector('.stage:not([data-explore])')
            }
          }
        } finally {
          await context.close()
        }
      }
    }
  } finally {
    await browser.close()
  }
  console.log(`  worlds: ${failures.length} failures`)
  return failures
}

// Behaviour (spec 010, P3 exit criteria): the detail dialog's keyboard and
// focus contract, and the first-visit intro handing over to the interface.
// Run without WebGL except the intro, which needs the scene to land.
async function checkBehaviour(noWebglBrowser) {
  const failures = []
  const fail = (id) => failures.push(`behaviour ${id}`)

  const context = await noWebglBrowser.newContext({ viewport: { width: 1440, height: 900 }, locale: BROWSER_LOCALE.en })
  try {
    const page = await context.newPage()
    watchCsp(page, 'behaviour dialog')
    await page.goto(`${BASE}${AGENTIC.en}?intro=0`)
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

    // Cube mode: the content and the dock leave, hidden so neither takes the
    // keyboard; the way back shows only to the keyboard, and the hint is read,
    // not shown. The way back and Esc bring everything back.
    await page.click('.stage-explore')
    await page.waitForSelector('.stage[data-explore]', { timeout: 5000 })
    await page.waitForTimeout(700)
    const opacity = (selector) => page.evaluate((s) => Number(getComputedStyle(document.querySelector(s)).opacity), selector)
    const exploring = await page.evaluate(() => {
      const hidden = (selector) => getComputedStyle(document.querySelector(selector)).visibility === 'hidden'
      const hint = document.querySelector('.stage-hint')
      const box = hint?.getBoundingClientRect()
      return {
        contentHidden: hidden('.stage-content'),
        dockHidden: hidden('.stage-dock'),
        hintReadNotShown: Boolean(hint?.textContent) && Boolean(box && box.width <= 1 && box.height <= 1),
      }
    })
    exploring.wayBackOutOfSight = (await opacity('.stage-explore')) === 0
    for (const [check, ok] of Object.entries(exploring)) if (!ok) fail(`explore ${check}`)
    // From the next control, back to the way back with the keyboard: it shows.
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await page.waitForTimeout(600)
    const focused = await page.evaluate(() => document.activeElement?.classList.contains('stage-explore'))
    if (!focused || (await opacity('.stage-explore')) !== 1) fail('explore way-back-hidden-from-keyboard')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.stage:not([data-explore])', { timeout: 5000 }).catch(() => fail('explore-way-back'))
    await page.click('.stage-explore')
    await page.waitForSelector('.stage[data-explore]', { timeout: 5000 })
    await page.keyboard.press('Escape')
    await page.waitForSelector('.stage:not([data-explore])', { timeout: 5000 }).catch(() => fail('explore-escape'))
    const back = await page.evaluate(() =>
      ['.stage-content', '.stage-dock'].every((selector) => getComputedStyle(document.querySelector(selector)).visibility !== 'hidden'),
    )
    if (!back) fail('explore-return')
  } finally {
    await context.close()
  }

  // Addresses (spec 012, AD-08): each language and face has a page of its own,
  // served in its language and under its title before any script runs; the
  // address bar follows what the visitor sees and shows no query (the
  // review's is read on arrival, then leaves the bar);
  // the bare address opens in the browser's language and then in the
  // visitor's last choice.
  const addressContext = await noWebglBrowser.newContext({ viewport: { width: 1440, height: 900 }, locale: BROWSER_LOCALE.es })
  try {
    const page = await addressContext.newPage()
    watchCsp(page, 'behaviour addresses')
    const served = await (await fetch(`${BASE}/es/seguridad`, { headers: { accept: 'text/html' } })).text()
    const servedRoot = await (await fetch(`${BASE}/`, { headers: { accept: 'text/html' } })).text()
    const titleOf = (html) => page.evaluate((source) => new DOMParser().parseFromString(source, 'text/html').title, html)
    const title = await titleOf(served)
    if (!served.includes('<html lang="es">')) fail('address-page-language')
    if (!title || title === (await titleOf(servedRoot))) fail('address-page-title')
    const where = () => page.evaluate(() => location.pathname + location.search)

    await page.goto(`${BASE}/?intro=0`)
    await page.waitForSelector('.stage[data-transition="idle"]', { timeout: 60000 })
    await page.waitForFunction(() => location.pathname === '/es', null, { timeout: 5000 }).catch(() => fail('address-root-language'))

    await page.goto(`${BASE}/es/seguridad?intro=0`)
    const onFace = await page.waitForSelector('.stage[data-transition="idle"][data-face="security"]', { timeout: 60000 }).then(() => true).catch(() => false)
    if (!onFace) fail('address-opens-face')
    const titled = await page.waitForFunction((expected) => document.title === expected, title, { timeout: 5000 }).then(() => true).catch(() => false)
    const opened = await page.evaluate(() => ({
      language: document.documentElement.lang === 'es',
      queryRead: location.search === '',
      dockLinks: [...document.querySelectorAll('.stage-dock a')].every((link) => /^\/es\/[a-z]+$/.test(link.getAttribute('href') ?? '')),
    }))
    for (const [check, ok] of Object.entries({ ...opened, title: titled })) if (!ok) fail(`address-face ${check}`)

    await page.click('.stage-dock a[data-section-id="products"]')
    await page.waitForSelector('.stage[data-transition="idle"][data-face="products"]', { timeout: 15000 })
    if ((await where()) !== '/es/productos') fail(`address-follows-face ${await where()}`)
    await page.click('.stage-locale button:text-is("EN")')
    const switched = await page
      .waitForFunction(() => location.pathname === '/products' && document.documentElement.lang === 'en', null, { timeout: 10000 })
      .then(() => true)
      .catch(() => false)
    if (!switched) fail(`address-follows-language ${await where()}`)

    await page.goto(`${BASE}/?intro=0`)
    await page.waitForSelector('.stage[data-transition="idle"]', { timeout: 60000 })
    await page.waitForTimeout(500)
    const remembered = (await where()) === '/' && (await page.evaluate(() => document.documentElement.lang)) === 'en'
    if (!remembered) fail(`address-remembers-language ${await where()}`)
  } finally {
    await addressContext.close()
  }

  // The intro hides the interface while the cube falls, then hands over; any
  // key skips it at once.
  const webglBrowser = await launch(SOFTWARE_WEBGL)
  const webglContext = await webglBrowser.newContext({ viewport: { width: 1366, height: 768 }, locale: BROWSER_LOCALE.en })
  webglContext.setDefaultTimeout(120000)
  try {
    const page = await webglContext.newPage()
    watchCsp(page, 'behaviour intro')
    await page.goto(`${BASE}/?intro=1`)
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
    // The desktop opens in cube mode: after the intro only the top shows,
    // until the visitor picks a face from the cube.
    const hidden = (selector) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).visibility === 'hidden', selector)
    const landing = {
      topShown: !(await hidden('.stage-top')),
      cubeMode: Boolean(await page.$('.stage[data-explore]')),
      contentHidden: await hidden('.stage-content'),
      dockHidden: await hidden('.stage-dock'),
    }
    for (const [check, ok] of Object.entries(landing)) if (!ok) fail(`intro-landing ${check}`)
    // A click on the cube, at the centre of the screen, opens the face under it.
    // Software WebGL may still be compiling the scene (nothing drawn, nothing to
    // hit): click again, as a visitor would once the cube shows.
    let picked = false
    for (let attempt = 0; attempt < 6 && !picked; attempt += 1) {
      await page.waitForTimeout(1500)
      await page.mouse.click(683, Math.round(768 * 0.45))
      picked = await page.waitForSelector('.stage:not([data-explore])', { timeout: 2500 }).then(() => true).catch(() => false)
    }
    if (!picked) fail('cube-click-picks-no-face')
    else {
      await page.waitForSelector('.stage[data-transition="idle"]')
      await page.waitForTimeout(800)
      if ((await hidden('.stage-content')) || (await hidden('.stage-dock'))) fail('cube-click-content-hidden')
    }
  } finally {
    await webglContext.close()
  }

  // The nudge: a first visitor gets the bubble over the waiting cube (cube
  // mode, on landing), clear of what shows, once; a later visit does not.
  const nudgeContext = await webglBrowser.newContext({ viewport: { width: 1366, height: 768 }, locale: BROWSER_LOCALE.en })
  nudgeContext.setDefaultTimeout(120000)
  try {
    const page = await nudgeContext.newPage()
    watchCsp(page, 'behaviour nudge')
    await page.goto(`${BASE}/?intro=0`)
    await page.waitForSelector('.stage[data-transition="idle"]')
    const shown = await page.waitForSelector('.cube-nudge[data-visible="true"]', { timeout: 20000 }).then(() => true).catch(() => false)
    if (!shown) fail('nudge-not-shown')
    else {
      await page.waitForTimeout(800)
      const placed = await page.evaluate(() => {
        const bubble = document.querySelector('.cube-nudge__bubble').getBoundingClientRect()
        const overlaps = (box) => bubble.left < box.right && box.left < bubble.right && bubble.top < box.bottom && box.top < bubble.bottom
        return {
          inView: bubble.top >= 0 && bubble.left >= 0 && bubble.right <= innerWidth,
          clearOfContent: ![...document.querySelectorAll('.stage-content > *, .stage-top > *')]
            .filter((element) => getComputedStyle(element).visibility !== 'hidden')
            .some((element) => overlaps(element.getBoundingClientRect())),
          remembered: localStorage.getItem('obsidian-cube:nudge-seen') === '1',
        }
      })
      for (const [check, ok] of Object.entries(placed)) if (!ok) fail(`nudge ${check}`)
    }
    // A later visit (the address no longer carries the review's query).
    await page.goto(`${BASE}/?intro=0`)
    await page.waitForSelector('.stage[data-transition="idle"]')
    await page.waitForTimeout(4500)
    if (await page.evaluate(() => Boolean(document.querySelector('.cube-nudge')))) fail('nudge-shown-twice')
  } finally {
    await webglBrowser.close()
  }

  console.log(`  behaviour: ${failures.length} failures`)
  return failures
}

function ownerContentIncomplete() {
  const ids = ['site.en', 'site.es', 'visual', 'profile.en', 'profile.es']
  return !reviewManifest || ids.some(id => !Array.isArray(reviewManifest.warnings?.[id])) ||
    Object.values(reviewManifest.faces).some(faces => faces.some(face => face.exampleFallback || face.fallbackFields.length > 0)) ||
    Object.values(reviewManifest.warnings).some(warnings => warnings.length > 0)
}

async function main() {
  if (args.has('--content-report')) {
    console.log(JSON.stringify({ documents: reviewManifest?.documents, faces: reviewManifest?.faces, warnings: reviewManifest?.warnings, contentAccepted: !ownerContentIncomplete() }, null, 2))
    process.exitCode = ownerContentIncomplete() ? 1 : 0
    return
  }
  const known = JSON.parse(readFileSync(KNOWN_PATH, 'utf8'))
  const preview = startPreview()
  let browser
  try {
    await waitForServer()
    browser = await launch(NO_WEBGL)
    // Stress content twice: every slot at its budget, then without the
    // optional blocks (audit-3 F-6).
    const variants = contentMode === 'stress' ? [['', false], ['bare', true]] : [['', false]]
    console.log(`Build tested: ${reviewBuild ?? 'dist (default build)'}`)
    if (reviewManifest) console.log(`Content provenance: ${JSON.stringify({ documents: reviewManifest.documents, faces: reviewManifest.faces })}`)
    else console.log('Content provenance: built files; owner drafts were not selected for this run.')
    console.log(`Layout check on ${viewports.length} viewports × ${LOCALES.length} locales, content: ${contentMode}${variants.length > 1 ? ' (full, then without the optional blocks)' : ''}`)
    const found = { layout: [], axe: [] }
    const modes = new Set()
    for (const viewport of viewports) {
      for (const locale of LOCALES) {
        for (const [variant, bare] of variants) {
          stressBare = bare
          const results = await checkPage(browser, viewport, locale, variant)
          found.layout.push(...results.layout)
          found.axe.push(...results.axe)
          modes.add(results.mode)
        }
      }
    }
    // A matrix that never renders a mode proves nothing about it: a rule under
    // that mode's variant could push a block off-screen unseen (audit-3 F-2).
    for (const mode of LAYOUT_MODES) {
      if (!modes.has(mode)) found.layout.push(`matrix ${mode} never rendered`)
    }

    if (contentMode === 'built') {
      found.layout.push(...(await checkDegradation(browser)))
      found.layout.push(...(await checkBehaviour(browser)))
      if (args.has('--worlds')) found.layout.push(...(await checkWorldContrast()))
    } else if (args.has('--worlds')) {
      console.log('  worlds: not run, the contrast over the worlds is measured on the built content')
    }
    found.layout.push(...cspViolations)

    if (args.has('--update-known') && contentMode !== 'built') {
      console.log('Known failures are recorded only for the built content.')
      process.exitCode = 1
      return
    }

    if (args.has('--update-known')) {
      // A blank page is never accepted as known debt.
      const degradation = found.layout.filter((id) => /^(degradation|behaviour|worlds|csp|matrix) /.test(id))
      if (degradation.length > 0) {
        for (const id of degradation) console.log(`FAIL ${id}`)
        console.log('Degradation, behaviour, world contrast and matrix failures cannot be recorded as known.')
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
      const knownSet = new Set(contentMode === 'built' && !reviewManifest ? known[kind] : [])
      const newFailures = found[kind].filter((id) => !knownSet.has(id))
      const fixed = [...knownSet].filter((id) => viewports.includes(id.split(' ')[0]) && !found[kind].includes(id))
      for (const id of newFailures) console.log(`NEW ${kind}: ${id}`)
      for (const id of fixed) console.log(`FIXED ${kind} (remove from the known list): ${id}`)
      if (newFailures.length > 0) failed = true
    }
    let contentRejected = false
    if (args.has('--require-complete-content')) {
      const incomplete = ownerContentIncomplete()
      if (incomplete) {
        console.log('OWNER CONTENT INCOMPLETE: missing review manifest, example fallback, or unresolved publish warnings. Geometry success does not accept the content.')
        contentRejected = true
      }
    }
    console.log(failed ? 'Layout check failed.' : 'Layout check passed (known failures only).')
    if (contentRejected) console.log('Owner content acceptance failed.')
    process.exitCode = failed || contentRejected ? 1 : 0
  } finally {
    await browser?.close()
    preview.kill()
  }
}

await main()
