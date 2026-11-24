// The methodology page (spec 022): one static page per language, rendered at
// build time from docs/methodology/*.md (vite.config.ts → methodologyPage).
// Pure and DOM-free, like renderSeo.ts. Its numbers are counted from the
// repository's paths, never typed.
import type { SiteLocale } from '../siteContent'
import { METHODOLOGY_PATHS, pagePath } from '../sitePaths'
import { PROFILE_PAGES } from './machineFiles'
import { renderLoopFigure } from './methodologyFigure'
import { markdownTitle, renderMarkdown } from './methodologyMarkdown'
import { absoluteUrl, escapeHtml, renderPageHead } from './renderSeo'
import type { SeoInput } from './renderSeo'

export type RecordCounts = { specs: number; audits: number; adrs: number }

/** Counts the records among the repository's paths, written with slashes. */
export function countRecords(paths: string[]): RecordCounts {
  const specs = new Set(paths.flatMap((path) => /^specs\/(\d{3}-[^/]+)\//.exec(path)?.[1] ?? []))
  return {
    specs: specs.size,
    audits: paths.filter((path) => /^specs\/\d{3}-[^/]+\/audit-\d+\.md$/.test(path)).length,
    adrs: paths.filter((path) => /^docs\/decisions\/\d{3}-[^/]+\.md$/.test(path)).length,
  }
}

const COPY: Record<SiteLocale, { description: string; site: string; other: string; profile: string; nav: string }> = {
  en: {
    description: 'How this site is built with AI agents: specs, audits without context, proportional gates, where a person decides, and what went wrong.',
    site: 'Interactive site',
    other: 'Versión en español',
    profile: 'Full profile',
    nav: 'Site',
  },
  es: {
    description: 'Cómo se construye este sitio con agentes de IA: specs, auditorías sin contexto, pruebas proporcionales, dónde decide una persona y qué salió mal.',
    site: 'Sitio interactivo',
    other: 'English version',
    profile: 'Perfil completo',
    nav: 'Sitio',
  },
}

export type MethodologyInput = { content: SeoInput; markdown: string; counts: RecordCounts; repositoryUrl: string }

export function renderMethodologyHead({ content, markdown }: MethodologyInput): string {
  const { identity, seo, locale } = content
  const headline = markdownTitle(markdown)
  const { description } = COPY[locale]
  const address = seo.siteUrl ? { url: absoluteUrl(METHODOLOGY_PATHS[locale], seo.siteUrl) } : {}
  return renderPageHead(content, {
    title: `${headline} | ${identity.displayName}`,
    description,
    ogType: 'article',
    path: (target) => METHODOLOGY_PATHS[target],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline,
      description,
      inLanguage: locale,
      ...address,
      // The person of the profile page (renderMachine.ts): one entity.
      author: { '@type': 'Person', '@id': `${seo.siteUrl ?? ''}/#person`, name: identity.fullName },
    },
  })
}

export function renderMethodologyBody({ content, markdown, counts, repositoryUrl }: MethodologyInput): string {
  const { identity, locale } = content
  const other: SiteLocale = locale === 'en' ? 'es' : 'en'
  const copy = COPY[locale]
  const home = pagePath({ locale, face: null })
  const language = `<a href="${METHODOLOGY_PATHS[other]}" hreflang="${other}" lang="${other}">${copy.other}</a>`
  const article = renderMarkdown(markdown, {
    repositoryUrl,
    values: { specs: String(counts.specs), audits: String(counts.audits), adrs: String(counts.adrs) },
    figures: { loop: renderLoopFigure(locale) },
  })
  return `<header class="method-bar">
      <a class="method-name" href="${home}">${escapeHtml(identity.displayName)} <span>${escapeHtml(identity.role)}</span></a>
      ${language}
    </header>
    <main class="method">
${article}
    </main>
    <footer class="method-foot">
      <nav aria-label="${copy.nav}"><a href="${home}">${copy.site}</a> <a href="/${PROFILE_PAGES[locale]}">${copy.profile}</a> ${language}</nav>
    </footer>`
}
