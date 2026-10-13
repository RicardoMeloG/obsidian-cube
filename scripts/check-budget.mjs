// First-view budget (spec 010, H-07).
//
// Counts everything a visitor downloads before the first face is shown:
// index.html, the entry script and its preloaded chunks, the stylesheets, and
// the public files the first view always loads (listed in the budget file).
// Sizes are gzip, as a CDN serves them. The limit is a ratchet: it is the last
// accepted value, plus 1% so builds with the example or the private content
// both fit, and it only goes down unless a spec raises it.
//
//   node scripts/check-budget.mjs           check dist/ against the limit
//   node scripts/check-budget.mjs --update  lower the limit to the current size
//
// Requires `npm run build` first.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const BUDGET_PATH = fileURLToPath(new URL('./checks/budget.json', import.meta.url))
const DIST = fileURLToPath(new URL('../dist', import.meta.url))

const budget = JSON.parse(readFileSync(BUDGET_PATH, 'utf8'))
const html = readFileSync(join(DIST, 'index.html'), 'utf8')

const referenced = [
  ...html.matchAll(/<script[^>]+src="\/([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="(?:modulepreload|stylesheet|preload)"[^>]+href="\/([^"]+)"/g),
].map((match) => match[1])

// alwaysLoaded entries may use * for the hash in a built file name.
const builtFiles = readdirSync(join(DIST, 'assets')).map((name) => `assets/${name}`)
const resolve = (pattern) =>
  pattern.includes('*') ? builtFiles.filter((file) => new RegExp(`^${pattern.replace(/[.]/g, '\\.').replace('*', '[^/]+')}$`).test(file)) : [pattern]

const files = ['index.html', ...new Set(referenced), ...budget.alwaysLoaded.flatMap(resolve)]
const sizes = files.map((file) => ({ file, gzip: gzipSync(readFileSync(join(DIST, file))).length }))
const total = sizes.reduce((sum, entry) => sum + entry.gzip, 0)
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

for (const entry of sizes) console.log(`  ${kb(entry.gzip).padStart(9)}  ${entry.file}`)
console.log(`First view: ${kb(total)} gzip (limit ${kb(budget.limitBytes)})`)

if (process.argv.includes('--update')) {
  if (total > budget.limitBytes) {
    console.log('Not raising the limit: a larger first view needs a spec that says why.')
    process.exitCode = 1
  } else {
    const limitBytes = Math.ceil(total * 1.01)
    writeFileSync(BUDGET_PATH, `${JSON.stringify({ ...budget, limitBytes }, null, 2)}\n`)
    console.log(`Limit set to ${kb(limitBytes)}.`)
  }
} else if (total > budget.limitBytes) {
  console.log(`Over budget by ${kb(total - budget.limitBytes)}.`)
  process.exitCode = 1
} else if (total < budget.limitBytes * 0.94) {
  console.log('More than 5% under the limit: run with --update to lock in the gain.')
}
