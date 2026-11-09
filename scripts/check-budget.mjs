// First-view budget (spec 010, H-07).
//
// Counts everything a visitor downloads before the first face is shown: the
// page's HTML, the entry script and its preloaded chunks, the stylesheets, and
// the public files the first view always loads (listed in the budget file).
// Every page of the site is a first view (one per language and face, spec 012,
// AD-08), and the heaviest one counts. Sizes are gzip, as a CDN serves them.
// The limit is a ratchet: it is the last
// accepted value, plus 1% so builds with the example or the private content
// both fit, and it only goes down unless a spec raises it.
//
//   node scripts/check-budget.mjs           check dist/ against the limit
//   node scripts/check-budget.mjs --update  lower the limit to the current size
//
// Requires `npm run build` first.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const BUDGET_PATH = fileURLToPath(new URL('./checks/budget.json', import.meta.url))
const reviewBuild = process.argv.find(arg => arg.startsWith('--out-dir='))?.slice('--out-dir='.length)
const DIST = reviewBuild ? resolvePath(reviewBuild) : fileURLToPath(new URL('../dist', import.meta.url))
console.log(`Build measured: ${DIST}`)

const budget = JSON.parse(readFileSync(BUDGET_PATH, 'utf8'))

// alwaysLoaded entries may use * for the hash in a built file name.
const builtFiles = readdirSync(join(DIST, 'assets')).map((name) => `assets/${name}`)
const resolve = (pattern) =>
  pattern.includes('*') ? builtFiles.filter((file) => new RegExp(`^${pattern.replace(/[.]/g, '\\.').replace('*', '[^/]+')}$`).test(file)) : [pattern]
const alwaysLoaded = budget.alwaysLoaded.flatMap(resolve)

// The site's pages are the HTML files that start the app; the profile pages
// for machines do not, and are no first view.
const pages = readdirSync(DIST, { recursive: true })
  .map((name) => relative(DIST, join(DIST, name)).replaceAll('\\', '/'))
  .filter((file) => file.endsWith('.html') && readFileSync(join(DIST, file), 'utf8').includes('<script type="module"'))
if (!pages.includes('index.html')) {
  console.log('dist/index.html is missing or does not start the app: run `npm run build` first.')
  process.exit(1)
}

function firstView(page) {
  const html = readFileSync(join(DIST, page), 'utf8')
  const referenced = [
    ...html.matchAll(/<script[^>]+src="\/([^"]+)"/g),
    ...html.matchAll(/<link[^>]+rel="(?:modulepreload|stylesheet|preload)"[^>]+href="\/([^"]+)"/g),
  ].map((match) => match[1])
  const sizes = [...new Set([page, ...referenced, ...alwaysLoaded])].map((file) => ({ file, gzip: gzipSync(readFileSync(join(DIST, file))).length }))
  return { page, referenced, sizes, total: sizes.reduce((sum, entry) => sum + entry.gzip, 0) }
}

const views = pages.map(firstView)
const heaviest = views.reduce((worst, view) => (view.total > worst.total ? view : worst))
const total = heaviest.total
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

for (const entry of heaviest.sizes) console.log(`  ${kb(entry.gzip).padStart(9)}  ${entry.file}`)
console.log(`First view: ${kb(total)} gzip, ${heaviest.page}, the heaviest of ${views.length} pages (limit ${kb(budget.limitBytes)})`)

// A built file the first view always needs is announced in every page, so the
// browser fetches it at once instead of after the CSS that names it (ADR 006).
for (const view of views) {
  const late = alwaysLoaded.filter((file) => file.startsWith('assets/') && !view.referenced.includes(file))
  for (const file of late) console.log(`Not preloaded from ${view.page}: ${file}`)
  if (late.length > 0) process.exitCode = 1
}

if (process.argv.includes('--update')) {
  if (total > budget.limitBytes) {
    console.log('Not raising the limit: a larger first view needs a spec that says why.')
    process.exitCode = 1
  } else {
    // Never above the current limit: the 1% headroom must not let the ratchet climb.
    const limitBytes = Math.min(budget.limitBytes, Math.ceil(total * 1.01))
    writeFileSync(BUDGET_PATH, `${JSON.stringify({ ...budget, limitBytes }, null, 2)}\n`)
    console.log(`Limit set to ${kb(limitBytes)}.`)
  }
} else if (total > budget.limitBytes) {
  console.log(`Over budget by ${kb(total - budget.limitBytes)}.`)
  process.exitCode = 1
} else if (total < budget.limitBytes * 0.94) {
  console.log('More than 5% under the limit: run with --update to lock in the gain.')
}
