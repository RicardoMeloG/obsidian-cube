// Static SEO for index.html, rendered at build time from the site content
// (vite.config.ts → seoFromContent). Crawlers that do not run JavaScript
// (GPTBot, ClaudeBot, Perplexity, link-preview scrapers; see
// docs/visitor-profile.md) only ever see this HTML, so it carries the identity,
// the share preview and a plain-text version of every face.
//
// Pure and DOM-free on purpose: it runs inside the Vite config (Node) and in
// Vitest. The input is a structural subset of SiteContent, so it does not
// import the content module (which touches `window`).

export type SeoInput = {
  locale: 'en' | 'es'
  identity: { displayName: string; fullName: string; role: string; keywords?: string }
  seo: { title: string; description: string; siteUrl?: string; image?: string }
  hero: { headline: string; summary: string }
  sections: {
    label: string
    title: string
    summary: string
    cta?: { label: string; href?: string }
    ctaSecondary?: { label: string; href?: string }
    detail?: { links?: { label: string; href?: string }[] }
  }[]
}

export const DEFAULT_SHARE_IMAGE = '/og-image.jpg'
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

// Rich text fields hold a small inline-HTML whitelist; the static page only
// needs their words.
export function toPlainText(richText: string): string {
  return richText
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function absoluteUrl(pathOrUrl: string, siteUrl?: string): string {
  if (/^https?:\/\//i.test(pathOrUrl) || !siteUrl) return pathOrUrl
  return `${siteUrl.replace(/\/+$/, '')}/${pathOrUrl.replace(/^\/+/, '')}`
}

function isPublicLink(href: string | undefined): href is string {
  return Boolean(href && /^https?:\/\//i.test(href))
}

// Only outside, absolute links are listed: in-page anchors and relative paths
// mean nothing to a crawler reading a single page.
function publicLinks(content: SeoInput): { label: string; href: string }[] {
  const seen = new Set<string>()
  const links: { label: string; href: string }[] = []
  for (const section of content.sections) {
    const candidates = [section.cta, section.ctaSecondary, ...(section.detail?.links ?? [])]
    for (const link of candidates) {
      if (!link || !isPublicLink(link.href) || seen.has(link.href)) continue
      seen.add(link.href)
      links.push({ label: link.label, href: link.href })
    }
  }
  return links
}

// schema.org `sameAs` names the person's own profiles, not their projects:
// a GitHub user page (one path segment) or a LinkedIn /in/ page.
export function isProfileUrl(href: string): boolean {
  try {
    const url = new URL(href)
    const host = url.hostname.replace(/^www\./, '')
    const segments = url.pathname.split('/').filter(Boolean)
    if (host === 'github.com') return segments.length === 1
    if (host === 'linkedin.com') return segments[0] === 'in' && segments.length === 2
    return false
  } catch {
    return false
  }
}

function keywordList(keywords?: string): string[] {
  return (keywords ?? '')
    .split('·')
    .map((keyword) => keyword.trim())
    .filter(Boolean)
}

export function buildPersonJsonLd(content: SeoInput): Record<string, unknown> {
  const { identity, seo } = content
  const person: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: identity.fullName,
    jobTitle: identity.role,
    description: seo.description,
  }
  const knowsAbout = keywordList(identity.keywords)
  if (knowsAbout.length > 0) person.knowsAbout = knowsAbout
  if (seo.siteUrl) person.url = seo.siteUrl
  const sameAs = publicLinks(content)
    .map((link) => link.href)
    .filter(isProfileUrl)
  if (sameAs.length > 0) person.sameAs = sameAs
  return person
}

// JSON inside <script> must not be able to close the tag.
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function renderHeadTags(content: SeoInput): string {
  const { identity, seo } = content
  const image = absoluteUrl(seo.image ?? DEFAULT_SHARE_IMAGE, seo.siteUrl)
  const ogLocale = content.locale === 'es' ? 'es_CL' : 'en_US'
  const ogAlternate = content.locale === 'es' ? 'en_US' : 'es_CL'
  const meta = (attr: 'name' | 'property', key: string, value: string) =>
    `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`

  const tags = [
    `<title>${escapeHtml(seo.title)}</title>`,
    meta('name', 'description', seo.description),
    meta('name', 'author', identity.fullName),
    meta('name', 'theme-color', '#08050d'),
    seo.siteUrl ? `<link rel="canonical" href="${escapeHtml(seo.siteUrl)}" />` : '',
    meta('property', 'og:type', 'website'),
    meta('property', 'og:title', seo.title),
    meta('property', 'og:description', seo.description),
    seo.siteUrl ? meta('property', 'og:url', seo.siteUrl) : '',
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', String(SHARE_IMAGE_SIZE.width)),
    meta('property', 'og:image:height', String(SHARE_IMAGE_SIZE.height)),
    meta('property', 'og:image:alt', `${identity.fullName} — ${identity.role}`),
    meta('property', 'og:locale', ogLocale),
    meta('property', 'og:locale:alternate', ogAlternate),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', seo.title),
    meta('name', 'twitter:description', seo.description),
    meta('name', 'twitter:image', image),
    `<script type="application/ld+json">${jsonForScript(buildPersonJsonLd(content))}</script>`,
  ]
  return tags.filter(Boolean).join('\n    ')
}

// Plain HTML version of the page for clients without JavaScript. Hidden for
// JavaScript visitors (the `js` class set in index.html) and replaced by React
// on mount, so people never see it flash.
export function renderStaticBody(content: SeoInput): string {
  const { identity, hero } = content
  const keywords = identity.keywords ? `\n        <p>${escapeHtml(identity.keywords)}</p>` : ''
  const sections = content.sections
    .map(
      (section) => `
        <section>
          <h2>${escapeHtml(section.label)} — ${escapeHtml(toPlainText(section.title))}</h2>
          <p>${escapeHtml(toPlainText(section.summary))}</p>
        </section>`,
    )
    .join('')
  const links = publicLinks(content)
  const linkList =
    links.length > 0
      ? `
        <ul>${links
          .map((link) => `\n          <li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`)
          .join('')}
        </ul>`
      : ''
  const note =
    content.locale === 'es'
      ? 'Este portafolio es una experiencia 3D interactiva; activa JavaScript para verla completa.'
      : 'This portfolio is an interactive 3D experience; enable JavaScript to see it in full.'

  return `<main class="seo-fallback">
        <h1>${escapeHtml(identity.fullName)}</h1>
        <p>${escapeHtml(identity.role)}</p>${keywords}
        <p>${escapeHtml(toPlainText(hero.headline))}</p>
        <p>${escapeHtml(toPlainText(hero.summary))}</p>${sections}${linkList}
        <p>${escapeHtml(note)}</p>
      </main>`
}
