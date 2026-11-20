// robots.txt and sitemap.xml (ADR 009, after the first release): crawlers,
// the AI ones by name, may read every page, and the sitemap lists the fourteen
// pages with their alternate in the other language. Both need the site's
// public address, so without it there is no sitemap and robots.txt does not
// point at one. Pure and DOM-free, like renderMachine.ts.
import type { SiteLocale } from '../siteContent'
import { pagePath, sitePages } from '../sitePaths'
import { absoluteUrl, escapeHtml } from './renderSeo'

export const ROBOTS_FILE = 'robots.txt'
export const SITEMAP_FILE = 'sitemap.xml'

// Named so the intent is explicit: the site wants to be read and cited.
export const AI_CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot']

export function renderRobotsTxt(siteUrl?: string): string {
  const groups = [...AI_CRAWLERS, '*'].map((agent) => `User-agent: ${agent}\nAllow: /`)
  const sitemap = siteUrl ? [`Sitemap: ${absoluteUrl(`/${SITEMAP_FILE}`, siteUrl)}`] : []
  return `${[...groups, ...sitemap].join('\n\n')}\n`
}

const OTHER: Record<SiteLocale, SiteLocale> = { en: 'es', es: 'en' }

export function renderSitemap(siteUrl: string): string {
  const url = (path: string) => escapeHtml(absoluteUrl(path, siteUrl))
  const entries = sitePages().map((page) => {
    const english = page.locale === 'en' ? page.path : pagePath({ locale: 'en', face: page.face })
    const alternates = [
      { lang: page.locale, href: page.path },
      { lang: OTHER[page.locale], href: pagePath({ locale: OTHER[page.locale], face: page.face }) },
      { lang: 'x-default', href: english },
    ]
    return [
      '  <url>',
      `    <loc>${url(page.path)}</loc>`,
      ...alternates.map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${url(alt.href)}"/>`),
      '  </url>',
    ].join('\n')
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')
}
