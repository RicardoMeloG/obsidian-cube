// @vitest-environment node
import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { markdownLinks, renderMarkdown, repositoryPath } from '../../src/kernel/seo/methodologyMarkdown'

// The methodology page's text (spec 022): every repository link names a file
// or a folder that exists, the two languages cite the same evidence, and the
// numbers are placeholders the build counts. Commit links are not checked.
const text = (locale: string) => readFileSync(`docs/methodology/methodology.${locale}.md`, 'utf8')
const shape = (markdown: string) =>
  markdown
    .split(/\r?\n/)
    .map((line) => /^(#{1,3} |- |\d+\. |\{\{figure:\w+\}\})/.exec(line)?.[1])
    .filter(Boolean)

describe.each(['en', 'es'])('methodology.%s.md', (locale) => {
  const links = markdownLinks(text(locale))

  it('stays in the Markdown subset', () => {
    const values = { specs: '1', audits: '1', adrs: '1' }
    expect(() => renderMarkdown(text(locale), { repositoryUrl: 'https://example.org/repo', values, figures: { loop: '' } })).not.toThrow()
  })

  it('links files and folders that exist', () => {
    const paths = links.flatMap((href) => repositoryPath(href) ?? [])
    expect(paths.length).toBeGreaterThan(0)
    const broken = paths.filter((path) => !existsSync(path) || statSync(path).isDirectory() !== path.endsWith('/'))
    expect(broken).toEqual([])
  })

  it('never types a count', () => {
    expect(text(locale)).not.toMatch(/\b\d+ (specs|audits|auditorías|ADRs?|decisiones|architecture decisions|tests|checks)\b/i)
  })
})

describe('the two languages', () => {
  it('cite the same evidence, with the same structure', () => {
    expect(markdownLinks(text('es'))).toEqual(markdownLinks(text('en')))
    expect(shape(text('es'))).toEqual(shape(text('en')))
  })
})

describe('methodology.html', () => {
  it('has no script and no inline style (the content security policy)', () => {
    expect(readFileSync('methodology.html', 'utf8')).not.toMatch(/<script|<style|\sstyle=/)
  })
})
