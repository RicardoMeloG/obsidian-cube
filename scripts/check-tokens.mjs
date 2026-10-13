// Token check (spec 010, H-08b; ADR 006): colours come from src/styles/tokens.css.
//
// Fails on a colour literal (#hex, rgb(), rgba(), hsl(), hsla()) in any source
// file outside the exempt paths below.
//
//   node scripts/check-tokens.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/g

// Where a literal is the right tool, and why.
const EXEMPT = [
  ['src/styles/tokens.css', 'the tokens themselves'],
  ['src/features/scene/', 'scene code: three.js materials and shaders take colour values'],
  ['src/kernel/faces.ts', 'default per-face accents, overridden at runtime by visual.json (ADR 003)'],
  ['src/kernel/seo/renderSeo.ts', 'the theme-color meta tag of the static HTML'],
  ['src/features/dev/', 'development tooling (the world showcase), never shipped to visitors'],
]

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [relative(ROOT, path).replace(/\\/g, '/')] : []
  })
}

const problems = []
for (const file of files(join(ROOT, 'src'))) {
  if (EXEMPT.some(([prefix]) => file.startsWith(prefix))) continue
  const found = readFileSync(join(ROOT, file), 'utf8').match(COLOUR) ?? []
  for (const literal of new Set(found)) problems.push(`${file}: ${literal}`)
}

for (const problem of problems) console.log(problem)
console.log(`Token check: ${problems.length} problems.`)
process.exitCode = problems.length > 0 ? 1 : 0
