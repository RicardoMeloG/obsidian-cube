// Where the layer for machines lives under the site root (spec 012, AD-07):
// rendered by renderMachine.ts, linked from index.html by renderSeo.ts.
import type { SiteLocale } from '../siteContent'

export const LLMS_FILE = 'llms.txt'
export const PROFILE_PAGES: Record<SiteLocale, string> = { en: 'profile.html', es: 'profile.es.html' }
