// Visual walkthrough (definition of done in AGENTS.md; spec 011, section 8):
// photographs every face in every layout, viewport and language, for a person
// to look at before a slice closes. The layout check proves geometry; this
// shows what a visitor sees, scene included (WebGL in software).
//
//   npm run build && node scripts/walkthrough.mjs
//   node scripts/walkthrough.mjs --viewport=1440x900 --lang=es
//   node scripts/walkthrough.mjs --admin     also the admin page (server on 5182)
//   node scripts/walkthrough.mjs --content=stress   every slot at its budget
//   node scripts/walkthrough.mjs --content=example  the committed example (safe to share)
//   --out-dir=<private build> --output=<empty private directory> photographs
//   an owner snapshot without replacing earlier evidence.
//
// Screenshots go to walkthrough/ (gitignored): they may show private content.
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, parse } from 'node:path'
import { chromium } from 'playwright'
import { buildStressContent } from './checks/stressContent.mjs'

const PORT = 4181
const BASE = `http://127.0.0.1:${PORT}`
const OUT = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length) ?? 'walkthrough'
const outputPath = resolve(OUT)
if (outputPath === parse(outputPath).root || outputPath === process.cwd() || !/(?:walkthrough|review|revision|capturas)/i.test(outputPath)) throw new Error('Unsafe walkthrough output directory')
const reviewBuild = process.argv.find(arg => arg.startsWith('--out-dir='))?.slice('--out-dir='.length)
const buildArgs = reviewBuild ? ['--outDir', reviewBuild] : []
const FACES = ['agentic', 'products', 'systems', 'security', 'research', 'contact']
const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]?.split(',') ?? fallback
const viewports = option('viewport', ['1440x900', '1366x768', '390x844'])
const locales = option('lang', ['es', 'en'])
const content = option('content', [])[0]
const stress = content === 'stress'
const readJson = (path) => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'))
const budgets = readJson('../src/kernel/layoutBudgets.json')

const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const server = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1', ...buildArgs], { stdio: 'ignore' })
const errors = []

try {
  for (let start = Date.now(); ; ) {
    try {
      if ((await fetch(BASE)).ok) break
    } catch {
      if (Date.now() - start > 30000) throw new Error(`vite preview did not answer on ${BASE}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  console.log(`Build photographed: ${reviewBuild ?? 'dist (default build)'}`)
  if (OUT === 'walkthrough') rmSync(OUT, { recursive: true, force: true })
  else if (existsSync(OUT) && readdirSync(OUT).length > 0) throw new Error('Custom review output must be empty; existing evidence is preserved')
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  for (const viewport of viewports) {
    const [width, height] = viewport.split('x').map(Number)
    {
      // Desktop shows the stage, stacked screens the hero (spec 011).
      const layout = 'stage'
      for (const locale of locales) {
        const page = await browser.newPage({ viewport: { width, height }, locale: locale === 'es' ? 'es-CL' : 'en-US' })
        // Without the private documents the site falls back to the example.
        if (content === 'example') await page.route('**/content/{site.*,visual}.json', (route) => route.fulfill({ status: 404, body: '' }))
        if (stress) {
          const example = readJson(`../public/content/site.example.${locale}.json`)
          const stand = readFileSync(fileURLToPath(new URL('../public/examples/project-1.webp', import.meta.url)))
          await page.route('**/content/media/*.webp', (route) => route.fulfill({ contentType: 'image/webp', body: stand }))
          await page.route('**/content/site.*.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(buildStressContent(example, budgets)) }))
        }
        page.on('pageerror', (error) => errors.push(`${layout} ${viewport} ${locale}: ${error.message}`))
        page.on('console', (message) => {
          // The example run refuses the private documents on purpose.
          if (content === 'example' && message.text().includes('status of 404')) return
          if (message.type() === 'error') errors.push(`${layout} ${viewport} ${locale}: ${message.text().slice(0, 160)}`)
        })
        // The desktop's first screen: cube mode, until a face is picked. Each
        // face's page is taken from the dock's own link (src/kernel/sitePaths.ts).
        await page.goto(`${BASE}${locale === 'es' ? '/es' : '/'}?intro=0`)
        await page.waitForTimeout(2500)
        if (width >= 720) await page.screenshot({ path: `${OUT}/${layout}-${viewport}-${locale}-landing.png` })
        const pages = Object.fromEntries(
          await page.$$eval('.stage-dock a[data-section-id]', (links) => links.map((link) => [link.dataset.sectionId, link.getAttribute('href')])),
        )
        for (const face of FACES) {
          await page.goto(`${BASE}${pages[face]}?intro=0`)
          await page.waitForTimeout(2500)
          await page.screenshot({ path: `${OUT}/${layout}-${viewport}-${locale}-${face}.png`, fullPage: width < 720 })
        }
        await page.close()
      }
    }
  }
  if (process.argv.includes('--admin')) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto('http://127.0.0.1:5182/').catch((error) => errors.push(`admin: ${error.message}`))
    await page.screenshot({ path: `${OUT}/admin-1440x900.png` })
  }
  await browser.close()
} finally {
  server.kill()
}

console.log(`Walkthrough written to ${OUT}/.`)
if (errors.length) {
  console.log(`${errors.length} page errors:\n${[...new Set(errors)].join('\n')}`)
  process.exitCode = 1
}
