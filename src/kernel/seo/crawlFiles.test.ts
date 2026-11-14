import { describe, expect, it } from 'vitest'
import { AI_CRAWLERS, renderRobotsTxt, renderSitemap } from './crawlFiles'
import { sitePages } from '../sitePaths'

const SITE = 'https://example.org'

describe('robots.txt', () => {
  it('lets every crawler read every page, the AI crawlers by name, and points at the sitemap', () => {
    const robots = renderRobotsTxt(SITE)
    for (const agent of [...AI_CRAWLERS, '*']) expect(robots).toContain(`User-agent: ${agent}\nAllow: /`)
    expect(robots).not.toMatch(/Disallow/)
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`)
  })

  it('names no sitemap without the public address', () => {
    expect(renderRobotsTxt()).not.toContain('Sitemap:')
  })
})

describe('sitemap.xml', () => {
  const xml = renderSitemap(`${SITE}/`)

  it('lists every page once, on its absolute clean address', () => {
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
    expect(locs).toEqual(sitePages().map((page) => `${SITE}${page.path}`))
    expect(locs).toHaveLength(14)
  })

  it('gives each page its alternate in the other language and an English x-default', () => {
    const security = xml.split('<url>').find((entry) => entry.includes(`<loc>${SITE}/es/seguridad</loc>`))!
    expect(security).toContain(`hreflang="es" href="${SITE}/es/seguridad"`)
    expect(security).toContain(`hreflang="en" href="${SITE}/security"`)
    expect(security).toContain(`hreflang="x-default" href="${SITE}/security"`)
  })

  it('is a sitemap document with the xhtml namespace for the alternates', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
  })
})
