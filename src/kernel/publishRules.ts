// Publish rules (spec 010, AD-02): what owner content must meet before the
// admin publishes it. Kept apart from SiteContentSchema on purpose: the site
// loads with the tolerant render contract, so content published under older
// rules keeps rendering instead of silently falling back to the example. The
// admin validates with PublishableSiteContentSchema and refuses to publish.
import { normalizeSections, SiteContentSchema } from './siteContent'
import type { SiteContent } from './siteContent'
import budgets from './layoutBudgets.json'

// Longest text, in characters, each rail field may hold, and how many items a
// rail shows (layoutBudgets.json, also read by the layout check's stress
// content). Set from the layout check: every field at its limit, in both
// locales, fits the shortest supported desktop (1280x720) without covering the
// face strip. `label` is the face name on the cube and the strip.
export const LAYOUT_BUDGETS = budgets.chars
export const LAYOUT_COUNTS = budgets.counts

// Placeholders of the example content that must never reach the public site.
const PLACEHOLDERS = ['your-handle', 'your-project', 'Portfolio Owner']

// Allowed link targets: the web over HTTPS, e-mail, or a path on this site.
export function isAllowedHref(href: string): boolean {
  return /^https:\/\/[^\s/]+\.[^\s]+$/i.test(href) || /^mailto:[^\s@]+@[^\s@]+$/i.test(href) || /^\/(?!\/)/.test(href) || /^#/.test(href)
}

// Rich text fields carry inline markup that takes no room on screen: count
// what the visitor reads.
export function visibleLength(value: string): number {
  return value.replace(/<[^>]*>/g, '').replace(/&[a-z0-9#]+;/gi, '_').length
}

function isOutsideLink(href: string): boolean {
  return /^(https:|mailto:)/i.test(href)
}

type Issue = { path: (string | number)[]; message: string }

export function publishIssues(content: SiteContent): Issue[] {
  const issues: Issue[] = []
  const tooLong = (path: Issue['path'], value: string | undefined, max: number) => {
    const length = value === undefined ? 0 : visibleLength(value)
    if (length > max) issues.push({ path, message: `Máximo ${max} caracteres (tiene ${length}).` })
  }
  const count = (path: Issue['path'], items: unknown[] | undefined, limits: { min?: number; max: number }) => {
    const length = items?.length ?? 0
    if (limits.min !== undefined && length < limits.min) issues.push({ path, message: `Mínimo ${limits.min} elementos.` })
    if (length > limits.max) issues.push({ path, message: `Máximo ${limits.max} elementos; la columna no muestra más.` })
  }

  content.sections.forEach((section, index) => {
    const at = (...path: (string | number)[]) => ['sections', index, ...path]
    tooLong(at('label'), section.label, LAYOUT_BUDGETS.label)
    tooLong(at('eyebrow'), section.eyebrow, LAYOUT_BUDGETS.eyebrow)
    tooLong(at('title'), section.title, LAYOUT_BUDGETS.title)
    tooLong(at('summary'), section.summary, LAYOUT_BUDGETS.summary)
    tooLong(at('flowTitle'), section.flowTitle, LAYOUT_BUDGETS.flowTitle)
    tooLong(at('ctaPrimary', 'label'), section.ctaPrimary?.label, LAYOUT_BUDGETS.ctaLabel)
    tooLong(at('ctaSecondary', 'label'), section.ctaSecondary?.label, LAYOUT_BUDGETS.ctaLabel)
    count(at('features'), section.features, LAYOUT_COUNTS.features)
    count(at('flow'), section.flow, LAYOUT_COUNTS.flow)
    count(at('researchConcepts'), section.researchConcepts, LAYOUT_COUNTS.researchConcepts)
    section.features?.forEach((feature, item) => {
      tooLong(at('features', item, 'label'), feature.label, LAYOUT_BUDGETS.featureLabel)
      tooLong(at('features', item, 'description'), feature.description, LAYOUT_BUDGETS.featureDescription)
    })
    section.flow?.forEach((step, item) => {
      tooLong(at('flow', item, 'label'), step.label, LAYOUT_BUDGETS.flowLabel)
      tooLong(at('flow', item, 'description'), step.description, LAYOUT_BUDGETS.flowDescription)
    })
    section.researchConcepts?.forEach((concept, item) => {
      tooLong(at('researchConcepts', item, 'axis'), concept.axis, LAYOUT_BUDGETS.conceptAxis)
      tooLong(at('researchConcepts', item, 'label'), concept.label, LAYOUT_BUDGETS.conceptLabel)
      tooLong(at('researchConcepts', item, 'summary'), concept.summary, LAYOUT_BUDGETS.conceptSummary)
    })

    // Every face links to at least one inspectable artifact (AGENTS.md,
    // "Evidence before spectacle"), and every link goes somewhere allowed.
    const links = [
      { path: at('ctaPrimary', 'href'), href: section.ctaPrimary?.href },
      { path: at('ctaSecondary', 'href'), href: section.ctaSecondary?.href },
      ...(section.detail?.links ?? []).map((link, item) => ({ path: at('detail', 'links', item, 'href'), href: link.href })),
      // Older fields, still shown when a face has no detail (audit-2 B-11).
      { path: at('cta', 'href'), href: section.cta?.href },
      ...(section.links ?? []).map((link, item) => ({ path: at('links', item, 'href'), href: link.href })),
    ].filter((link): link is { path: Issue['path']; href: string } => Boolean(link.href))
    for (const link of links) {
      if (!isAllowedHref(link.href)) issues.push({ path: link.path, message: 'Usa un enlace https: o mailto:, o una ruta de este sitio.' })
    }
    if (!links.some((link) => isOutsideLink(link.href))) {
      issues.push({ path: at(), message: 'Enlaza al menos un artefacto (https: o mailto:) desde esta cara.' })
    }
  })

  const serialized = JSON.stringify(content)
  for (const placeholder of PLACEHOLDERS) {
    if (serialized.includes(placeholder)) issues.push({ path: [], message: `Reemplaza el texto de ejemplo "${placeholder}".` })
  }
  return issues
}

// What a visitor will see: a field a published face leaves empty is filled
// from the example in the same language (normalizeSections), so the rules
// check the filled content, or an example placeholder could slip through an
// empty field (audit-2 B-01).
export function visibleContent(content: SiteContent): SiteContent {
  return { ...content, sections: normalizeSections(content.sections, content.locale) as unknown as SiteContent['sections'] }
}

export const PublishableSiteContentSchema = SiteContentSchema.superRefine((content, context) => {
  const visible = visibleContent(content)
  for (const issue of publishIssues(visible)) {
    // Point at the face in the document as written, not its place in the face order.
    const path = [...issue.path]
    if (path[0] === 'sections' && typeof path[1] === 'number') {
      const id = visible.sections[path[1]]?.id
      const index = content.sections.findIndex((section) => section.id === id)
      path[1] = index === -1 ? id ?? path[1] : index
    }
    context.addIssue({ code: 'custom', path, message: issue.message })
  }
})
