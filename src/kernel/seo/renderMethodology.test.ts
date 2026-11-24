import { describe, expect, it } from 'vitest'
import exampleEn from '../../../public/content/site.example.en.json'
import exampleEs from '../../../public/content/site.example.es.json'
import { SiteContentSchema } from '../siteContent'
import type { SiteLocale } from '../siteContent'
import { markdownTitle, renderMarkdown } from './methodologyMarkdown'
import { countRecords, renderMethodologyBody, renderMethodologyHead } from './renderMethodology'

const REPO = 'https://github.com/ada/site'
const SITE = 'https://example.org'
const markdown = '# How\n\nMade of {{specs}} specs, {{audits}} audits, {{adrs}} ADRs.\n\n{{figure:loop}}\n'
const example = { en: SiteContentSchema.parse(exampleEn), es: SiteContentSchema.parse(exampleEs) }

function input(locale: SiteLocale) {
  const content = { ...example[locale], seo: { ...example[locale].seo, siteUrl: SITE } }
  return { content, markdown, counts: { specs: 3, audits: 5, adrs: 2 }, repositoryUrl: REPO }
}

const render = (text: string) => renderMarkdown(text, { repositoryUrl: REPO, values: { specs: '3' }, figures: { loop: '<figure></figure>' } })

describe('the Markdown subset', () => {
  it('renders headings, paragraphs, lists, bold, code and figures', () => {
    expect(render('## Two\n\nOne\nline.\n\n- **a** b\n- `x < y`\n\n1. c\n2. d\n\n{{figure:loop}}')).toBe(
      '<h2>Two</h2>\n<p>One line.</p>\n<ul>\n<li><strong>a</strong> b</li>\n<li><code>x &lt; y</code></li>\n</ul>\n<ol>\n<li>c</li>\n<li>d</li>\n</ol>\n<figure></figure>',
    )
  })

  it('reads Windows line endings and lines of spaces as blank ones', () => {
    expect(render('a\r\n\r\nb\r\n  \r\nc')).toBe('<p>a</p>\n<p>b</p>\n<p>c</p>')
  })

  it('points repository links at main, files and folders apart, and keeps site and web links', () => {
    expect(render('[a](../../AGENTS.md)')).toContain(`href="${REPO}/blob/main/AGENTS.md"`)
    expect(render('[a](../../docs/decisions/)')).toContain(`href="${REPO}/tree/main/docs/decisions"`)
    expect(render('[a](/security)')).toContain('href="/security"')
    expect(render('[a](https://example.org/x)')).toContain('href="https://example.org/x"')
  })

  it.each(['javascript:alert', 'http://example.org', '//example.org', 'AGENTS.md', '../../../x', '../../a/../../x', '../../', 'mailto:a@example.org', '#x'])('refuses the link %s', (href) => {
    expect(() => render(`[a](${href})`)).toThrow('link not allowed')
  })

  it.each([
    '<b>raw</b>',
    'a < b',
    'a &amp; <br>',
    '#### four',
    '##no space',
    '* bullet',
    '+ bullet',
    '> quote',
    '| a | b |',
    '---',
    '```\ncode\n```',
    '    code',
    '- a\n  - nested',
    '- a\ncontinued',
    '2. starts late',
    '1. a\n1. b',
    '1) a',
    '## heading\ntext',
    'text\n- list',
    '*emphasis*',
    '_emphasis_',
    '**open',
    '`open',
    '![image](../../x.png)',
    '[reference][x]',
    '[a](../../AGENTS.md "title")',
    '\\*escaped',
    '{{unknown}}',
    '{{figure:unknown}}',
    'text {{figure:loop}}',
    '{{toString}}',
  ])('fails on %j', (text) => {
    expect(() => render(text)).toThrow('[methodology]')
  })

  it('escapes the text', () => {
    expect(render('Q&A "x"')).toBe('<p>Q&amp;A &quot;x&quot;</p>')
  })

  it('takes the title from the one first-level heading', () => {
    expect(markdownTitle('# How\n\ntext')).toBe('How')
    expect(() => markdownTitle('text\n\n# How')).toThrow()
    expect(() => markdownTitle('# How\n\n# Again')).toThrow()
  })
})

describe('the counts', () => {
  it('counts spec folders, audit records and ADRs, and nothing else', () => {
    const paths = [
      'specs/README.md',
      'specs/001-a/spec.md',
      'specs/001-a/audit-1.md',
      'specs/001-a/audit-2.md',
      'specs/002-b/spec.md',
      'specs/002-b/audit-notes.md',
      'specs/draft/spec.md',
      'specs/002-b',
      'docs/decisions/README.md',
      'docs/decisions/001-x.md',
      'docs/other/002-y.md',
    ]
    expect(countRecords(paths)).toEqual({ specs: 2, audits: 2, adrs: 1 })
  })
})

describe.each([
  { locale: 'en' as const, path: '/methodology', home: 'href="/"', other: '/es/metodologia' },
  { locale: 'es' as const, path: '/es/metodologia', home: 'href="/es"', other: '/methodology' },
])('the page in $locale', ({ locale, path, home, other }) => {
  const head = renderMethodologyHead(input(locale))
  const body = renderMethodologyBody(input(locale))

  it('carries its title, description, canonical and the hreflang pair', () => {
    expect(head).toContain(`<title>How | ${example[locale].identity.displayName}</title>`)
    expect(head).toMatch(/<meta name="description" content="[^"]{60,160}" \/>/)
    expect(head).toContain(`<link rel="canonical" href="${SITE}${path}" />`)
    expect(head).toContain(`hreflang="en" href="${SITE}/methodology"`)
    expect(head).toContain(`hreflang="es" href="${SITE}/es/metodologia"`)
    expect(head).toContain(`<meta property="og:url" content="${SITE}${path}" />`)
  })

  it('names the person of the profile page as the author', () => {
    const json = JSON.parse(/<script type="application\/ld\+json">(.*)<\/script>/.exec(head)![1])
    expect(json['@type']).toBe('TechArticle')
    expect(json.inLanguage).toBe(locale)
    expect(json.author['@id']).toBe(`${SITE}/#person`)
  })

  it('has JSON-LD as its only script, and no inline style', () => {
    expect(head.match(/<script/g)).toHaveLength(1)
    expect(body).not.toMatch(/<script|<style|\sstyle=/)
  })

  it('links the site and the other language', () => {
    expect(body).toContain(home)
    expect(body).toContain(`href="${other}"`)
  })

  it('writes the counts and draws the loop with its seven steps as text', () => {
    expect(body).toContain('Made of 3 specs, 5 audits, 2 ADRs.')
    expect(body.match(/class="loop-text"/g)).toHaveLength(7)
  })
})
