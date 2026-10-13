// Token check (spec 010, H-08b; ADR 006): colours and type come from
// src/styles/tokens.css. Fails on:
// - a colour literal in any source file or public stylesheet outside the
//   exempt paths below: hex, the colour functions (rgb, hsl, hwb, lab, lch,
//   oklab, oklch, color), and named colours in CSS declarations or in
//   arbitrary Tailwind values. Tailwind's default palette is removed in
//   tokens.css, so a utility such as `text-red-500` does not exist;
// - an arbitrary size, leading or tracking that is not a per-mode refinement;
// - a colour token nothing uses.
//
//   node scripts/check-tokens.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FUNCTIONAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/g
const NAMES = 'white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|maroon|navy|teal|olive|lime|aqua|fuchsia|cyan|magenta|gold|violet|indigo|crimson|coral|salmon'
// A named colour as a CSS value (after `:`) or inside an arbitrary Tailwind value.
const NAMED_IN_CSS = new RegExp(`:[^;{}]*?(?<![\\w-])(${NAMES})(?![\\w-])`, 'gi')
const NAMED_IN_CLASS = new RegExp(`\\[(${NAMES})\\]`, 'gi')

// Where a literal is the right tool, and why.
const EXEMPT = [
  ['src/styles/tokens.css', 'the tokens themselves'],
  ['src/features/scene/', 'scene code: three.js materials and shaders take colour values'],
  ['src/kernel/faces.ts', 'default per-face accents, overridden at runtime by visual.json (ADR 003)'],
  ['src/kernel/seo/renderSeo.ts', 'the theme-color meta tag of the static HTML'],
  ['src/features/dev/', 'development tooling (the world showcase), never shipped to visitors'],
  ['public/seo-fallback.css', 'the plain page for clients without JavaScript, independent of the app stylesheet'],
]

function files(directory, pattern) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return name === 'content' ? [] : files(path, pattern)
    return pattern.test(name) && !/\.test\.tsx?$/.test(name) ? [relative(ROOT, path).replace(/\\/g, '/')] : []
  })
}

const sources = [...files(join(ROOT, 'src'), /\.(tsx?|css)$/), ...files(join(ROOT, 'public'), /\.css$/)]
const problems = []
for (const file of sources) {
  if (EXEMPT.some(([prefix]) => file.startsWith(prefix))) continue
  const text = readFileSync(join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '')
  const found = [
    ...(text.match(FUNCTIONAL) ?? []),
    ...[...text.matchAll(file.endsWith('.css') ? NAMED_IN_CSS : NAMED_IN_CLASS)].map((match) => match[1]),
  ]
  for (const literal of new Set(found)) problems.push(`${file}: ${literal}`)
}

// Type comes from the roles in tokens.css (`text-face-title`…): an arbitrary
// size, leading or tracking is allowed only as a per-mode refinement
// (`narrow:text-[0.62rem]`), never as an element's base type (audit-2 B-13).
const BASE_TYPE = /(?<![\w:-])(?:text-\[(?:[\d.]+(?:rem|px|em)|clamp\([^\]]*)\]|tracking-\[[^\]]+\]|leading-\[[^\]]+\])/g
for (const file of sources.filter((file) => file.endsWith('.tsx'))) {
  if (EXEMPT.some(([prefix]) => file.startsWith(prefix))) continue
  for (const value of new Set(readFileSync(join(ROOT, file), 'utf8').match(BASE_TYPE) ?? [])) problems.push(`${file}: ${value} (use a type role)`)
}

// Every colour token is used: as a utility (`text-ink-50/80`) or a variable
// (`var(--color-ink-50)`), in a component or in another token (audit-2 B-13).
const tokensFile = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8')
const everything = sources.map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n')
for (const [, name] of tokensFile.matchAll(/^\s*--color-([a-z0-9-]+):/gm)) {
  const uses = everything.match(new RegExp(`-${name}(?![\\w-])`, 'g'))?.length ?? 0
  // One match is the definition itself.
  if (uses <= 1) problems.push(`src/styles/tokens.css: --color-${name} is never used`)
}

for (const problem of problems) console.log(problem)
console.log(`Token check: ${problems.length} problems in ${sources.length} files.`)
process.exitCode = problems.length > 0 ? 1 : 0
