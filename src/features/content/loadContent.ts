import { getDefaultSiteContent, SiteContentSchema } from '@/kernel/siteContent'
import type { SiteContent, SiteLocale } from '@/kernel/siteContent'
import { readPagePath } from '@/kernel/sitePaths'
import { getDefaultVisualContent, normalizeVisual, VisualContentSchema } from '@/kernel/visualContent'
import type { VisualContent } from '@/kernel/visualContent'

// Browser side of the content kernel: locale detection and fetching the
// published documents. Validation and defaults stay in src/kernel.

// The language the visitor last chose, kept on this browser only: the bare
// address names no language, so it opens on that choice.
const LOCALE_KEY = 'obsidian-cube:locale'

function rememberedLocale(): string | null {
  try {
    return window.localStorage.getItem(LOCALE_KEY)
  } catch {
    return null
  }
}

export function rememberLocale(locale: SiteLocale) {
  try {
    window.localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    // Storage blocked: the address still carries the language.
  }
}

// The language a path names (`/es/…`, or an English face), otherwise the
// visitor's last choice, otherwise the browser's language.
export function resolveSiteLocale(pathname = window.location.pathname, remembered = rememberedLocale(), browserLanguage = navigator.language): SiteLocale {
  const named = readPagePath(pathname)?.locale
  if (named) return named
  if (remembered === 'en' || remembered === 'es') return remembered
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
