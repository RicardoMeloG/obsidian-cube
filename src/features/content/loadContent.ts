import { getDefaultSiteContent, SiteContentSchema } from '@/kernel/siteContent'
import type { SiteContent, SiteLocale } from '@/kernel/siteContent'
import { getDefaultVisualContent, normalizeVisual, VisualContentSchema } from '@/kernel/visualContent'
import type { VisualContent } from '@/kernel/visualContent'

// Browser side of the content kernel: locale detection and fetching the
// published documents. Validation and defaults stay in src/kernel.

export function resolveSiteLocale(search = window.location.search, browserLanguage = navigator.language): SiteLocale {
  const requestedLocale = new URLSearchParams(search).get('lang')

  if (requestedLocale === 'en' || requestedLocale === 'es') {
    return requestedLocale
  }

  return browserLanguage.toLowerCase().startsWith('es') ? 'es' : 'en'
}

// A missing document is expected (no private content yet): the host may answer
// with a 404 or with index.html, so only JSON responses are parsed.
async function fetchJson(path: string): Promise<unknown | undefined> {
  const response = await fetch(path, { cache: 'no-store' })
  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false
  return response.ok && isJson ? response.json() : undefined
}

export async function loadSiteContent(locale: SiteLocale): Promise<SiteContent> {
  const path = `/content/site.${locale}.json`

  try {
    const document = await fetchJson(path)
    if (document !== undefined) return SiteContentSchema.parse(document)
  } catch (error) {
    console.warn(`Could not load site content from ${path}`, error)
  }

  return getDefaultSiteContent(locale)
}

export async function loadVisualContent(): Promise<VisualContent> {
  for (const path of ['/content/visual.json', '/content/visual.example.json']) {
    try {
      const document = await fetchJson(path)
      if (document !== undefined) return normalizeVisual(VisualContentSchema.parse(document))
    } catch (error) {
      console.warn(`Could not load visual content from ${path}`, error)
    }
  }

  return getDefaultVisualContent()
}
