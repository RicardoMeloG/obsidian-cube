// Static SEO for every page of the site (one per language and face,
// sitePaths.ts), rendered at build time from the site content (vite.config.ts
// → seoPages). Crawlers that do not run JavaScript (GPTBot, ClaudeBot,
// Perplexity, link-preview scrapers) only ever see
// this HTML, so it carries the identity, the page's share preview and a
// plain-text version of every face.
//
// Pure and DOM-free, like the rest of the kernel: it runs inside the Vite
// config (Node) and in Vitest. The input is the content document the schema
// validated (vite.config.ts parses it first).
import type { FaceId } from '../faces'
import type { SiteContent, SiteLocale } from '../siteContent'
import { pagePath } from '../sitePaths'
import { LLMS_FILE, PROFILE_PAGES } from './machineFiles'

export type SeoInput = SiteContent

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

export function absoluteUrl(pathOrUrl: string, siteUrl?: string): string {
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
    const candidates = [section.ctaPrimary, section.ctaSecondary, ...(section.detail?.links ?? []), ...(section.links ?? [])]
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
// Parsed by hand rather than with `URL`, which is not part of the ES library
// the kernel compiles against (ADR 005).
export function isProfileUrl(href: string): boolean {
  const match = /^https?:\/\/(?:www\.)?([^/?#:]+)([^?#]*)/i.exec(href)
  if (!match) return false
  const host = match[1].toLowerCase()
  const segments = match[2].split('/').filter(Boolean)
  if (host === 'github.com') return segments.length === 1
  if (host === 'linkedin.com') return segments[0] === 'in' && segments.length === 2
  return false
}

export function keywordList(keywords?: string): string[] {
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
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

const OTHER_LOCALE: Record<SiteLocale, SiteLocale> = { en: 'es', es: 'en' }
const LANGUAGE_NAME: Record<SiteLocale, string> = { en: 'English', es: 'Español' }

const faceSection = (content: SeoInput, face: FaceId | null) => (face ? content.sections.find((section) => section.id === face) : undefined)

// A face's page is titled and described by the face, so a link to it
// previews that face; the cube's page (face null) by the site.
export function pageTitle(content: SeoInput, face: FaceId | null): string {
  const section = faceSection(content, face)
  return section ? `${section.title} | ${content.identity.displayName}` : content.seo.title
}

function pageDescription(content: SeoInput, face: FaceId | null): string {
  const section = faceSection(content, face)
  return section ? toPlainText(section.summary) : content.seo.description
}

export function renderHeadTags(content: SeoInput, face: FaceId | null = null): string {
  const { identity, seo, locale } = content
  const title = pageTitle(content, face)
  const description = pageDescription(content, face)
  const image = absoluteUrl(seo.image ?? DEFAULT_SHARE_IMAGE, seo.siteUrl)
  const ogLocale = content.locale === 'es' ? 'es_CL' : 'en_US'
  const ogAlternate = content.locale === 'es' ? 'en_US' : 'es_CL'
  const meta = (attr: 'name' | 'property', key: string, value: string) =>
    `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`
  // Search engines want this page's address, and its other language's, in
  // full: they wait for the site URL, like the canonical.
  const url = (target: SiteLocale) => absoluteUrl(pagePath({ locale: target, face }), seo.siteUrl)
  const alternate = (hreflang: string, target: SiteLocale) => `<link rel="alternate" hreflang="${hreflang}" href="${escapeHtml(url(target))}" />`
  const addresses = seo.siteUrl
    ? [`<link rel="canonical" href="${escapeHtml(url(locale))}" />`, alternate('en', 'en'), alternate('es', 'es'), alternate('x-default', 'en')]
    : []

  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    meta('name', 'description', description),
    meta('name', 'author', identity.fullName),
    meta('name', 'theme-color', '#08050d'),
    ...addresses,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    seo.siteUrl ? meta('property', 'og:url', url(locale)) : '',
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', String(SHARE_IMAGE_SIZE.width)),
    meta('property', 'og:image:height', String(SHARE_IMAGE_SIZE.height)),
    meta('property', 'og:image:alt', `${identity.fullName} — ${identity.role}`),
    meta('property', 'og:locale', ogLocale),
    meta('property', 'og:locale:alternate', ogAlternate),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', image),
    `<script type="application/ld+json">${jsonForScript(buildPersonJsonLd(content))}</script>`,
  ]
  return tags.filter(Boolean).join('\n    ')
}

// Plain HTML version of the page for clients without JavaScript. Hidden for
// JavaScript visitors (the `js` class that /js-flag.js sets) and replaced by React
// on mount, so people never see it flash. Each face heading links its page and
// the page links its other language, so a crawler reaches every page.
export function renderStaticBody(content: SeoInput, face: FaceId | null = null): string {
  const { identity, hero, locale } = content
  const other = OTHER_LOCALE[locale]
  const keywords = identity.keywords ? `\n        <p>${escapeHtml(identity.keywords)}</p>` : ''
  const sections = content.sections
    .map(
      (section) => `
        <section>
          <h2><a href="${pagePath({ locale, face: section.id })}">${escapeHtml(section.label)} — ${escapeHtml(toPlainText(section.title))}</a></h2>
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
  // The layer for machines, in full (ADR 009).
  const profile = content.locale === 'es' ? 'Perfil completo' : 'Full profile'

  return `<main class="seo-fallback">
        <h1>${escapeHtml(identity.fullName)}</h1>
        <p>${escapeHtml(identity.role)}</p>${keywords}
        <p>${escapeHtml(toPlainText(hero.headline))}</p>
        <p>${escapeHtml(toPlainText(hero.summary))}</p>${sections}${linkList}
        <p><a href="/${PROFILE_PAGES[locale]}">${profile}</a> · <a href="/${LLMS_FILE}">${LLMS_FILE}</a> · <a href="${pagePath({ locale: other, face })}" hreflang="${other}" lang="${other}">${LANGUAGE_NAME[other]}</a></p>
        <p>${escapeHtml(note)}</p>
      </main>`
}
