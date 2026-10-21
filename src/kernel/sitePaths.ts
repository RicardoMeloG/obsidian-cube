// The site's addresses (owner, 2026-10-20; spec 012, AD-08): one page per
// language and face, each on a clean path (`/security`, `/es/seguridad`), and
// the bare `/` and `/es` for the cube. English, the primary language, lives at
// the root. The slugs are a public contract, since shared links point at them,
// so they never follow the labels the content gives the faces. The build
// renders one static HTML file per page (vite.config.ts); the browser reads and
// writes the same paths (src/features/experience/faceUrl.ts).
import { FACE_ORDER } from './faces'
import type { FaceId } from './faces'
import type { SiteLocale } from './siteContent'

export const FACE_SLUGS: Record<SiteLocale, Record<FaceId, string>> = {
  en: { agentic: 'agentic', products: 'products', systems: 'systems', security: 'security', research: 'research', contact: 'contact' },
  es: { agentic: 'agentico', products: 'productos', systems: 'sistemas', security: 'seguridad', research: 'investigacion', contact: 'contacto' },
}

const ROOT_LOCALE: SiteLocale = 'en'
const LOCALE_SEGMENT: Record<SiteLocale, string | null> = { en: null, es: 'es' }
const LOCALES = Object.keys(LOCALE_SEGMENT) as SiteLocale[]

// A face of null is the cube: the page opens on it, no face named.
export type SitePage = { locale: SiteLocale; face: FaceId | null }

export function pagePath({ locale, face }: SitePage): string {
  const segments = [LOCALE_SEGMENT[locale], face && FACE_SLUGS[locale][face]].filter(Boolean)
  return `/${segments.join('/')}`
}

// The page a path names, or null when it names none. A trailing slash names
// the same page. The bare root names no language: the visitor's choice decides.
export function readPagePath(pathname: string): { locale: SiteLocale | null; face: FaceId | null } | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return { locale: null, face: null }
  const prefixed = LOCALES.find((locale) => LOCALE_SEGMENT[locale] === segments[0])
  const locale = prefixed ?? ROOT_LOCALE
  const slugs = prefixed ? segments.slice(1) : segments
  if (slugs.length === 0) return { locale, face: null }
  if (slugs.length > 1) return null
  const face = FACE_ORDER.find((candidate) => FACE_SLUGS[locale][candidate] === slugs[0])
  return face ? { locale, face } : null
}

// Every page the build writes, the cube's English page first, with the file
// that serves its path (`/es` from `es.html`, as `vite preview` resolves it;
// CloudFront at the release, AD-08). A function, so the browser bundle,
// which never lists pages, leaves it out.
export function sitePages(): (SitePage & { path: string; file: string })[] {
  return LOCALES.flatMap((locale) =>
    [null, ...FACE_ORDER].map((face) => {
      const path = pagePath({ locale, face })
      return { locale, face, path, file: path === '/' ? 'index.html' : `${path.slice(1)}.html` }
    }),
  )
}
