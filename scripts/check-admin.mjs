// Admin form check (spec 011, AD-04 and section 4): the admin page, with its
// form generated from the kernel's schemas, round-trips every example
// document unchanged, and its editing controls (lists, template switch, image
// upload, field errors) write what they show. The page runs in Chromium
// against a stand-in API answered here, so the check needs neither Postgres
// nor the server, and runs the same in CI. The schemas come from the server's
// own `formSchema`, loaded through Vite so the TypeScript runs as is.
//
//   node scripts/check-admin.mjs
//   node scripts/check-admin.mjs --screenshots   also photographs the form into walkthrough/
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'vite'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const ORIGIN = 'http://admin.test'
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url))
const examples = {
  'site.en': JSON.parse(read('public/content/site.example.en.json')),
  'site.es': JSON.parse(read('public/content/site.example.es.json')),
  visual: JSON.parse(read('public/content/visual.example.json')),
  'profile.en': JSON.parse(read('public/content/profile.example.en.json')),
  'profile.es': JSON.parse(read('public/content/profile.example.es.json')),
}
const IMAGE = read('public/examples/project-2.webp')
const UPLOADED = { hash: 'b'.repeat(64), src: `/content/media/${'b'.repeat(64)}.webp`, width: 1600, height: 1000 }

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { formSchema } = await vite.ssrLoadModule('/server/content/docs.ts')
const schemas = Object.fromEntries(Object.keys(examples).map((id) => [id, formSchema(id)]))
await vite.close()

// Key order does not matter to the site or the schema.
const canonical = (value) =>
  JSON.stringify(value, (_, node) => (node && typeof node === 'object' && !Array.isArray(node) ? Object.fromEntries(Object.entries(node).sort(([a], [b]) => a.localeCompare(b))) : node))

const failures = []
const fail = (id, detail) => failures.push(detail ? `${id}: ${detail}` : id)

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const saved = []
let validation = { ok: true }
page.on('pageerror', (error) => fail('page-error', error.message))
page.on('dialog', (dialog) => dialog.accept())

await page.route(`${ORIGIN}/**`, async (route) => {
  const request = route.request()
  const { pathname } = new URL(request.url())
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: read('server/admin/index.html') })
  if (/^\/form(-kit|-media)?\.js$/.test(pathname)) return route.fulfill({ contentType: 'text/javascript', body: read(`server/admin${pathname}`) })
  if (pathname === '/auth/me') return json({ authenticated: true, username: 'check' })
  if (/^\/(content\/media|examples)\//.test(pathname)) return route.fulfill({ contentType: 'image/webp', body: IMAGE })
  if (pathname === '/api/media' && request.method() === 'GET') return json([])
  if (pathname === '/api/media') return json(UPLOADED)
  if (/^\/api\/media\/[a-f0-9]{64}\/thumb$/.test(pathname)) return json({ thumb: `/content/media/${UPLOADED.hash}-thumb.webp` })
  let match = /^\/api\/schema\/(.+)$/.exec(pathname)
  if (match) return json(schemas[match[1]])
  match = /^\/api\/content\/([^/]+)(\/.*)?$/.exec(pathname)
  if (match) {
    const [, doc, action] = match
    if (!action) return json({ data: structuredClone(examples[doc]), source: 'ejemplo' })
    if (action === '/versions') return json({ message: 'sin BD' }, 503)
    if (action === '/validate') return json(validation)
    if (action === '/draft') {
      saved.push({ doc, body: request.postDataJSON() })
      return json({ ok: true })
    }
  }
  return json({ message: `unexpected ${request.method()} ${pathname}` }, 404)
})

// Each click that loads a document re-renders the form; wait for it.
async function loading(click) {
  await page.evaluate(() => delete document.getElementById('form').dataset.ready)
  await click()
  await page.waitForSelector('#form[data-ready="true"]')
}
async function open(kind, id, lang) {
  await loading(() => page.click(id ? `.nav-item[data-kind="${kind}"][data-id="${id}"]` : `.nav-item[data-kind="${kind}"]`))
  if (lang && !(await page.$(`#langSwitch button[data-lang="${lang}"].active`))) await loading(() => page.click(`#langSwitch button[data-lang="${lang}"]`))
}
async function save() {
  const before = saved.length
  await page.click('#saveDraft')
  for (let tries = 0; saved.length === before && tries < 100; tries += 1) await page.waitForTimeout(50)
  if (saved.length === before) throw new Error('the draft was not sent')
  return saved[saved.length - 1].body
}

await page.goto(`${ORIGIN}/`)
await page.waitForSelector('#form[data-ready="true"]')

// 1. Round trip: every face in both languages, the site-wide block, the
// profile for machines and the visual document come back exactly as they were
// loaded, each to its own document.
const FACES = examples['site.en'].sections.map((section) => section.id)
for (const lang of ['en', 'es']) {
  for (const face of FACES) {
    await open('face', face, lang)
    const body = await save()
    if (canonical(body) !== canonical(examples[`site.${lang}`])) fail('round-trip', `${face} ${lang}`)
  }
  await open('general', null, lang)
  if (canonical(await save()) !== canonical(examples[`site.${lang}`])) fail('round-trip', `general ${lang}`)
  await open('profile', null, lang)
  if (canonical(await save()) !== canonical(examples[`profile.${lang}`]) || saved.at(-1).doc !== `profile.${lang}`) fail('round-trip', `profile ${lang}`)
}
await open('visual')
if (canonical(await save()) !== canonical(examples.visual)) fail('round-trip', 'visual')

// 2. Lists: add a step and remove it, move one down and back up.
await open('face', 'agentic', 'en')
const steps = '[data-path="composition.steps"]'
await page.click(`${steps} > .sf-add`)
await page.click(`${steps} > ol > li:last-child .sf-remove`)
await page.click(`${steps} > ol > li:first-child button[title="Bajar"]`)
await page.click(`${steps} > ol > li:nth-child(2) button[title="Subir"]`)
if (canonical(await save()) !== canonical(examples['site.en'])) fail('list-controls')

// 3. Template switch: another template and back restores what was written.
await page.selectOption('[data-path="composition.template"] select', 'catalog')
if ((await save()).sections[0].composition.template !== 'catalog') fail('template-switch', 'catalog not applied')
await page.selectOption('[data-path="composition.template"] select', 'showcase')
if (canonical(await save()) !== canonical(examples['site.en'])) fail('template-switch', 'switching back lost the slots')

// 4. A text edit reaches the document.
await page.fill('[data-path="composition.stepsTitle"] input', 'How I work')
if ((await save()).sections[0].composition.stepsTitle !== 'How I work') fail('text-edit')

// 5. Image upload: resized in the browser, stored, and written with its thumbnail and alt.
await open('face', 'products')
await page.setInputFiles('[data-path="composition.items.0.image"] input[type=file]', { name: 'shot.png', mimeType: 'image/png', buffer: read('public/og-image.jpg') })
await page
  .waitForFunction((hash) => document.querySelector('[data-path="composition.items.0.image"] img.sf-preview')?.getAttribute('src')?.includes(hash), UPLOADED.hash, { timeout: 10000 })
  .catch(async () => fail('image-upload', await page.textContent('[data-path="composition.items.0.image"] .sf-hint')))
const image = (await save()).sections[1].composition.items[0].image
const expected = { src: UPLOADED.src, thumb: `/content/media/${UPLOADED.hash}-thumb.webp`, alt: examples['site.en'].sections[1].composition.items[0].image.alt, width: 1600, height: 1000 }
if (canonical(image) !== canonical(expected)) fail('image-upload', JSON.stringify(image))

if (process.argv.includes('--screenshots')) {
  mkdirSync('walkthrough', { recursive: true })
  for (const [kind, id] of [['face', 'agentic'], ['face', 'products'], ['face', 'contact'], ['general', null], ['profile', null], ['visual', null]]) {
    await open(kind, id)
    await page.screenshot({ path: `walkthrough/admin-${id ?? kind}.png` })
    // The composition's first list item unfolded, as the owner edits it.
    await page.locator('.sf-union .sf-list summary .sf-preview-text').first().click().catch(() => undefined)
    await page.evaluate(() => (document.getElementById('form').scrollTop = 700))
    await page.screenshot({ path: `walkthrough/admin-${id ?? kind}-2.png` })
  }
  await open('face', 'products')
  await page.locator('.sf-union .sf-list summary .sf-preview-text').first().click()
  await page.locator('[data-path="composition.items.0.image"]').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'walkthrough/admin-image.png' })
  await open('face', 'products')
}

// 6. The server's errors mark their fields.
validation = { ok: false, errors: [{ path: 'sections.1.composition.listTitle', message: 'Máximo 24 caracteres (tiene 30).' }] }
await page.click('#validate')
await page.waitForSelector('[data-path="composition.listTitle"].sf-error', { timeout: 3000 }).catch(() => fail('error-marking'))

await browser.close()
if (failures.length) {
  console.log(`Admin check failed:\n${failures.map((line) => `  ${line}`).join('\n')}`)
  process.exitCode = 1
} else {
  console.log(`Admin check passed: ${FACES.length * 2 + 5} documents round-trip, lists, template switch, text, image upload, error marking.`)
}
