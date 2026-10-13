// Token check (spec 010, H-08b; ADR 006): colours come from src/styles/tokens.css.
//
// Fails on a colour literal (#hex, rgb(), rgba(), hsl(), hsla()) in any source
// file outside the exempt paths below. App.css is legacy being migrated (P4):
// its literals may only go down from the count in scripts/checks/tokens.json.
//
//   node scripts/check-tokens.mjs           check
//   node scripts/check-tokens.mjs --update  lower the App.css count to the current one

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LIMITS_PATH = fileURLToPath(new URL('./checks/tokens.json', import.meta.url))
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/g

// Where a literal is the right tool, and why.
const EXEMPT = [
  ['src/styles/tokens.css', 'the tokens themselves'],
  ['src/features/premium-cube/scene/', 'scene code: three.js materials and shaders take colour values'],
  ['src/kernel/faces.ts', 'default per-face accents, overridden at runtime by visual.json (ADR 003)'],
  ['src/kernel/seo/renderSeo.ts', 'the theme-color meta tag of the static HTML'],
]
const LEGACY = 'src/App.css'

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [relative(ROOT, path).replace(/\\/g, '/')] : []
  })
}

const limits = JSON.parse(readFileSync(LIMITS_PATH, 'utf8'))
const problems = []
let legacyCount = 0

for (const file of files(join(ROOT, 'src'))) {
  if (EXEMPT.some(([prefix]) => file.startsWith(prefix))) continue
  const text = readFileSync(join(ROOT, file), 'utf8')
  const found = text.match(COLOUR) ?? []
  if (file === LEGACY) {
    legacyCount = found.length
    continue
  }
  for (const literal of new Set(found)) problems.push(`${file}: ${literal}`)
}

if (process.argv.includes('--update')) {
  if (legacyCount > limits.appCssLiterals) {
    console.log(`Not raising the App.css limit (${limits.appCssLiterals} → ${legacyCount}).`)
    process.exitCode = 1
  } else {
    writeFileSync(LIMITS_PATH, `${JSON.stringify({ ...limits, appCssLiterals: legacyCount }, null, 2)}\n`)
    console.log(`App.css limit set to ${legacyCount}.`)
  }
} else {
  for (const problem of problems) console.log(problem)
  if (legacyCount > limits.appCssLiterals) problems.push(`${LEGACY}: ${legacyCount} colour literals, limit ${limits.appCssLiterals}`)
  console.log(`Token check: ${problems.length} problems; App.css carries ${legacyCount} legacy literals (limit ${limits.appCssLiterals}).`)
  process.exitCode = problems.length > 0 ? 1 : 0
}
