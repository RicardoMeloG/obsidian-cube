import { describe, expect, it } from 'vitest'
import exampleEn from '../../public/content/site.example.en.json'
import { buildPersonJsonLd, escapeHtml, isProfileUrl, renderHeadTags, renderStaticBody, toPlainText } from './renderSeo'
import type { SeoInput } from './renderSeo'

const base: SeoInput = {
  locale: 'en',
  identity: {
    displayName: 'Ada Example',
    fullName: 'Ada Example',
    role: 'Agentic Product Engineer',
    keywords: 'AI Engineer · LLM agents · Python · AWS',
  },
  seo: { title: 'Ada Example — Agentic Product Engineer', description: 'Builds products with agents.' },
  hero: { headline: 'Headline', summary: 'Summary with <strong>emphasis</strong>.' },
  sections: [
    {
      label: 'PRODUCTS',
      title: 'Public Products',
      summary: 'Tools &amp; experiments.',
      cta: { label: 'Repository', href: 'https://github.com/ada/tool' },
      detail: {
        links: [
          { label: 'GitHub', href: 'https://github.com/ada' },
          { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ada-example/' },
          { label: 'Anchor', href: '#products' },
          { label: 'Duplicate', href: 'https://github.com/ada' },
        ],
      },
    },
  ],
}

describe('escapeHtml and toPlainText', () => {
  it('escapes markup-significant characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })

  it('strips inline tags and decodes basic entities', () => {
    expect(toPlainText('Design <strong>autonomous</strong>&nbsp;systems &amp; <em>impact</em>')).toBe(
      'Design autonomous systems & impact',
    )
  })
})

describe('isProfileUrl', () => {
  it('accepts a GitHub user page and a LinkedIn /in/ page', () => {
    expect(isProfileUrl('https://github.com/ada')).toBe(true)
    expect(isProfileUrl('https://www.linkedin.com/in/ada-example/')).toBe(true)
  })

  it('rejects repositories, other hosts and invalid URLs', () => {
    expect(isProfileUrl('https://github.com/ada/tool')).toBe(false)
    expect(isProfileUrl('https://example.com/ada')).toBe(false)
    expect(isProfileUrl('not a url')).toBe(false)
  })
})

describe('buildPersonJsonLd', () => {
  it('describes the person with keywords and profile links only', () => {
    expect(buildPersonJsonLd(base)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Ada Example',
      jobTitle: 'Agentic Product Engineer',
      description: 'Builds products with agents.',
      knowsAbout: ['AI Engineer', 'LLM agents', 'Python', 'AWS'],
      sameAs: ['https://github.com/ada', 'https://www.linkedin.com/in/ada-example/'],
    })
  })

  it('adds the site URL when known', () => {
    const withUrl = { ...base, seo: { ...base.seo, siteUrl: 'https://ada.example' } }
    expect(buildPersonJsonLd(withUrl).url).toBe('https://ada.example')
  })
})

describe('renderHeadTags', () => {
  it('renders title, description and a relative share image without a site URL', () => {
    const head = renderHeadTags(base)
    expect(head).toContain('<title>Ada Example — Agentic Product Engineer</title>')
    expect(head).toContain('<meta name="description" content="Builds products with agents." />')
    expect(head).toContain('<meta property="og:image" content="/og-image.jpg" />')
    expect(head).not.toContain('canonical')
  })

  it('makes the share image absolute and adds canonical once the site URL is set', () => {
    const head = renderHeadTags({ ...base, seo: { ...base.seo, siteUrl: 'https://ada.example/', image: 'share.png' } })
    expect(head).toContain('<link rel="canonical" href="https://ada.example/" />')
    expect(head).toContain('<meta property="og:image" content="https://ada.example/share.png" />')
  })

  it('escapes content so it cannot break out of attributes or the JSON-LD script', () => {
    const hostile = { ...base, seo: { ...base.seo, title: '"><script>x</script>', description: '</script><b>' } }
    const head = renderHeadTags(hostile)
    expect(head).not.toContain('<script>x</script>')
    expect(head.match(/<\/script>/g)).toHaveLength(1)
  })
})

describe('renderStaticBody', () => {
  it('lists identity, every face as plain text and the outside links once', () => {
    const body = renderStaticBody(base)
    expect(body).toContain('<h1>Ada Example</h1>')
    expect(body).toContain('<p>AI Engineer · LLM agents · Python · AWS</p>')
    expect(body).toContain('<p>Summary with emphasis.</p>')
    expect(body).toContain('<h2>PRODUCTS — Public Products</h2>')
    expect(body).toContain('<p>Tools &amp; experiments.</p>')
    expect(body.match(/href="https:\/\/github.com\/ada"/g)).toHaveLength(1)
    expect(body).not.toContain('#products')
  })

  it('renders the committed example content', () => {
    const body = renderStaticBody(exampleEn as SeoInput)
    expect(body.match(/<section>/g)).toHaveLength(6)
  })
})
