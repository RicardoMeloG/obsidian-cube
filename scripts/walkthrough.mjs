// Visual walkthrough (definition of done in AGENTS.md; spec 011, section 8):
// photographs every face in every layout, viewport and language, for a person
// to look at before a slice closes. The layout check proves geometry; this
// shows what a visitor sees, scene included (WebGL in software).
//
//   npm run build && node scripts/walkthrough.mjs
//   node scripts/walkthrough.mjs --layout=escenario --viewport=1440x900
//   node scripts/walkthrough.mjs --admin     also the admin page (server on 5182)
//
// Screenshots go to walkthrough/ (gitignored): they may show private content.
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const PORT = 4181
const BASE = `http://127.0.0.1:${PORT}`
const OUT = 'walkthrough'
const FACES = ['agentic', 'products', 'systems', 'security', 'research', 'contact']
const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]?.split(',') ?? fallback
const viewports = option('viewport', ['1440x900', '1366x768', '390x844'])
const layouts = option('layout', ['rails', 'escenario'])
const locales = option('lang', ['es', 'en'])

const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const server = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' })
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
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  for (const viewport of viewports) {
    const [width, height] = viewport.split('x').map(Number)
    for (const layout of layouts) {
      for (const locale of locales) {
        const page = await browser.newPage({ viewport: { width, height } })
        page.on('pageerror', (error) => errors.push(`${layout} ${viewport} ${locale}: ${error.message}`))
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(`${layout} ${viewport} ${locale}: ${message.text().slice(0, 160)}`)
        })
        for (const face of FACES) {
          const stage = layout === 'escenario' ? '&layout=escenario' : ''
          await page.goto(`${BASE}/?intro=0&lang=${locale}&section=${face}${stage}`)
          await page.waitForTimeout(2500)
          await page.screenshot({ path: `${OUT}/${layout}-${viewport}-${locale}-${face}.png`, fullPage: width < 720 })
        }
        await page.close()
      }
    }
  }
  if (process.argv.includes('--admin')) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto('http://127.0.0.1:5182/admin/').catch((error) => errors.push(`admin: ${error.message}`))
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
