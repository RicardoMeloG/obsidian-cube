// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LAYOUT_QUERIES } from './layoutModes'

// One source for the layout modes (ADR 006, spec 010 AD-06 and H-17).
function sourceFiles(directory: string, pattern = /\.tsx?$/): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return sourceFiles(path, pattern)
    return pattern.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

// Every stylesheet of the site.
const css = sourceFiles('src', /\.css$/)
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')
const mediaQueries = [...css.matchAll(/@media ([^{]+)\{/g)].map((match) => match[1].trim())

// Media queries that are not layout modes.
const OTHER_QUERIES = ['(prefers-reduced-motion: reduce)']

describe('layout modes', () => {
  it('are the only media queries in the CSS', () => {
    const allowed = new Set<string>([...Object.values(LAYOUT_QUERIES), ...OTHER_QUERIES])
    expect(mediaQueries.filter((query) => !allowed.has(query))).toEqual([])
  })

  it('are all declared in the CSS, so a renamed query cannot silently stop applying', () => {
    for (const query of Object.values(LAYOUT_QUERIES)) {
      expect(mediaQueries).toContain(query)
    }
  })

  it('make desktop the exact complement of stacked', () => {
    expect(LAYOUT_QUERIES.desktop).toBe(`(not (${LAYOUT_QUERIES.stacked.replace(', ', ' or ')}))`)
    expect(LAYOUT_QUERIES.desktopShort.startsWith(LAYOUT_QUERIES.desktop)).toBe(true)
  })

  it('leave no numeric breakpoint in the components', () => {
    // A width or height compared with a pixel-sized number, or the 4/3 aspect.
    const numeric = /\b\w*(?:[Ww]idth|[Hh]eight)\s*[<>]=?\s*\d{3,}|<=?\s*4\s*\/\s*3/
    const offenders = sourceFiles('src')
      .filter((file) => !file.replace(/\\/g, '/').endsWith('src/styles/layoutModes.ts'))
      .filter((file) => numeric.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('leave no width variant outside the layout modes', () => {
    // Tailwind's own breakpoints are removed in tokens.css; arbitrary ones
    // (max-[900px]:, min-[...]:) would bypass the modes.
    const variant = /(?<![\w-])(?:sm|md|lg|xl|2xl|(?:max|min)-\[[^\]]+\]):/
    const offenders = sourceFiles('src').filter((file) => variant.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
