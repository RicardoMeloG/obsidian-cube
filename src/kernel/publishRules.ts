import { z } from 'zod/mini'
// Publish rules (spec 010, AD-02): what owner content must meet before the
// admin publishes it. Kept apart from SiteContentSchema on purpose: the site
// loads with the tolerant render contract, so content published under older
// rules keeps rendering instead of silently falling back to the example. The
// admin checks them with publishRuleIssues: they block the publish only in the
// production environment, and are warnings while the project is in
// development (APP_ENV, server/appEnv.ts, owner 2026-10-18).
import { EXAMPLE_MEDIA_PREFIX } from './compositions'
import type { Composition, TemplateId } from './compositions'
import { normalizeSections, SiteContentSchema } from './siteContent'
import type { SiteContent } from './siteContent'
import budgets from './layoutBudgets.json'

// Longest text, in characters, each field of a face's heading may hold, and
// the name, role and keywords of the top bar, shown on every face (audit-3
// F-4). layoutBudgets.json is also read by the layout check's stress content.
// Set from the layout check: every field at its limit, in both locales, fits
// every supported screen. `label` is the face name on the cube and the dock.
export const LAYOUT_BUDGETS = budgets.chars

// Budgets of each composition template (spec 011, AD-06), by slot path:
// `a.b` is a field, `a[]` every item of a list, `a.*` every value of an object.
type Limits = { min?: number; max: number }
export type TemplateBudget = { chars: Record<string, number>; counts: Record<string, Limits> }
export const TEMPLATE_BUDGETS = budgets.templates as unknown as Record<TemplateId, TemplateBudget>

// Every value a slot path reaches, with its path inside the composition.
export function slotValues(root: unknown, slot: string): { path: (string | number)[]; value: unknown }[] {
  let found: { path: (string | number)[]; value: unknown }[] = [{ path: [], value: root }]
  for (const segment of slot.split('.')) {
    const many = segment.endsWith('[]')
    const key = many ? segment.slice(0, -2) : segment
    found = found.flatMap(({ path, value }) => {
      if (value === null || typeof value !== 'object') return []
      const record = value as Record<string, unknown>
      const children = key === '*' ? Object.keys(record).map((name) => ({ path: [...path, name], value: record[name] })) : [{ path: [...path, key], value: record[key] }]
      if (!many) return children.filter((child) => child.value !== undefined)
      return children.flatMap((child) => (Array.isArray(child.value) ? child.value.map((item, index) => ({ path: [...child.path, index], value: item })) : []))
    })
  }
  return found
}

// Every link a composition holds, wherever its template puts it.
function compositionLinks(value: unknown, path: (string | number)[] = []): { path: (string | number)[]; href: string }[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => compositionLinks(item, [...path, index]))
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) =>
    key === 'href' && typeof child === 'string' ? [{ path: [...path, key], href: child }] : compositionLinks(child, [...path, key]),
  )
}

// Placeholders of the example content that must never reach the public site.
const PLACEHOLDERS = ['your-handle', 'your-project', 'Portfolio Owner']

// The example labels its made-up data; owner content shows real data or leaves
// the block out (the map and the images are optional, 2026-10-16).
const ILLUSTRATIVE = /illustrative data|datos ilustrativos/i

// Allowed link targets: the web over HTTPS, e-mail, or a path on this site.
export function isAllowedHref(href: string): boolean {
  return /^https:\/\/[^\s/]+\.[^\s]+$/i.test(href) || /^mailto:[^\s@]+@[^\s@]+$/i.test(href) || /^\/(?!\/)/.test(href) || /^#/.test(href)
}

// Rich text fields carry inline markup that takes no room on screen: count
// what the visitor reads.
export function visibleLength(value: string): number {
  return value.replace(/<[^>]*>/g, '').replace(/&[a-z0-9#]+;/gi, '_').length
}

// An inspectable artifact lives on the web. A mailto: is a channel, not an
// artifact (audit-3 F-3): CONTACT meets the rule with its profile links.
function isArtifactLink(href: string): boolean {
  return /^https:/i.test(href)
}

export type Issue = { path: (string | number)[]; message: string }

export function publishIssues(content: SiteContent): Issue[] {
  const issues: Issue[] = []
  const tooLong = (path: Issue['path'], value: string | undefined, max: number) => {
    const length = value === undefined ? 0 : visibleLength(value)
    if (length > max) issues.push({ path, message: `Máximo ${max} caracteres (tiene ${length}).` })
  }
  const count = (path: Issue['path'], items: unknown[] | undefined, limits: Limits) => {
    const length = items?.length ?? 0
    if (limits.min !== undefined && length < limits.min) issues.push({ path, message: `Mínimo ${limits.min} elementos.` })
    if (length > limits.max) issues.push({ path, message: `Máximo ${limits.max} elementos; la columna no muestra más.` })
  }

  // The top bar shows these on every face and in every mode (audit-3 F-4).
  tooLong(['identity', 'displayName'], content.identity.displayName, LAYOUT_BUDGETS.name)
  tooLong(['identity', 'role'], content.identity.role, LAYOUT_BUDGETS.role)
  tooLong(['identity', 'keywords'], content.identity.keywords, LAYOUT_BUDGETS.keywords)

  content.sections.forEach((section, index) => {
    const at = (...path: (string | number)[]) => ['sections', index, ...path]
    tooLong(at('label'), section.label, LAYOUT_BUDGETS.label)
    tooLong(at('eyebrow'), section.eyebrow, LAYOUT_BUDGETS.eyebrow)
    tooLong(at('title'), section.title, LAYOUT_BUDGETS.title)
    tooLong(at('summary'), section.summary, LAYOUT_BUDGETS.summary)
    tooLong(at('ctaPrimary', 'label'), section.ctaPrimary?.label, LAYOUT_BUDGETS.ctaLabel)
    tooLong(at('ctaSecondary', 'label'), section.ctaSecondary?.label, LAYOUT_BUDGETS.ctaLabel)
    tooLong(at('tagline'), section.tagline, LAYOUT_BUDGETS.tagline)
    if (section.composition) checkComposition(section.composition, (...path) => at('composition', ...path))
    // Every face links to at least one inspectable artifact (AGENTS.md,
    // "Evidence before spectacle"), and every link goes somewhere allowed.
    const links = [
      { path: at('ctaPrimary', 'href'), href: section.ctaPrimary?.href },
      { path: at('ctaSecondary', 'href'), href: section.ctaSecondary?.href },
      ...(section.detail?.links ?? []).map((link, item) => ({ path: at('detail', 'links', item, 'href'), href: link.href })),
      // Older field, still shown when a face has no detail (audit-2 B-11).
      ...(section.links ?? []).map((link, item) => ({ path: at('links', item, 'href'), href: link.href })),
      ...compositionLinks(section.composition).map((link) => ({ path: at('composition', ...link.path), href: link.href })),
    ].filter((link): link is { path: Issue['path']; href: string } => Boolean(link.href))
    for (const link of links) {
      if (!isAllowedHref(link.href)) issues.push({ path: link.path, message: 'Usa un enlace https: o mailto:, o una ruta de este sitio.' })
    }
    if (!links.some((link) => isArtifactLink(link.href))) {
      issues.push({ path: at(), message: 'Enlaza al menos un artefacto (https:) desde esta cara.' })
    }
  })

  for (const [name, href] of Object.entries(content.identity.links ?? {})) {
    if (href && !isAllowedHref(href)) issues.push({ path: ['identity', 'links', name], message: 'Usa un enlace https:.' })
  }

  const serialized = JSON.stringify(content)
  for (const placeholder of PLACEHOLDERS) {
    if (serialized.includes(placeholder)) issues.push({ path: [], message: `Reemplaza el texto de ejemplo "${placeholder}".` })
  }
  if (serialized.includes(`"${EXAMPLE_MEDIA_PREFIX}`)) {
    issues.push({ path: [], message: 'Reemplaza las imágenes de ejemplo por imágenes subidas desde el admin.' })
  }
  if (ILLUSTRATIVE.test(serialized)) {
    issues.push({ path: [], message: 'Los datos ilustrativos no se publican: pon datos reales o quita el bloque.' })
  }
  return issues

  function checkComposition(composition: Composition, at: (...path: (string | number)[]) => Issue['path']) {
    const budget = TEMPLATE_BUDGETS[composition.template]
    for (const [slot, max] of Object.entries(budget.chars)) {
      for (const { path, value } of slotValues(composition, slot)) {
        if (typeof value === 'string') tooLong(at(...path), value, max)
      }
    }
    for (const [slot, limits] of Object.entries(budget.counts)) {
      // A list slot counts each list it reaches (`items[].facts`: the facts of each item).
      for (const { path, value } of slotValues(composition, slot)) {
        if (Array.isArray(value)) count(at(...path), value, limits)
      }
    }
  }
}

// What a visitor will see: a field a published face leaves empty is filled
// from the example in the same language (normalizeSections), so the rules
// check the filled content, or an example placeholder could slip through an
// empty field (audit-2 B-01).
export function visibleContent(content: SiteContent): SiteContent {
  return { ...content, sections: normalizeSections(content.sections, content.locale) as unknown as SiteContent['sections'] }
}

// A face whose two languages use different templates (spec 011, AD-02): a
// warning, not an error, so a template can be changed one language at a time.
// Compares what a visitor sees: a face without a composition shows the
// example's.
export function templateMismatches(content: SiteContent, other: SiteContent): Issue[] {
  const mine = normalizeSections(content.sections, content.locale)
  const theirs = normalizeSections(other.sections, other.locale)
  return mine.flatMap((section) => {
    const counterpart = theirs.find((candidate) => candidate.id === section.id)
    if (!counterpart || counterpart.composition.template === section.composition.template) return []
    const index = content.sections.findIndex((candidate) => candidate.id === section.id)
    return [
      {
        path: index === -1 ? ['sections'] : ['sections', index, 'composition', 'template'],
        message: `La versión ${other.locale.toUpperCase()} de ${section.label} usa la plantilla «${counterpart.composition.template}»; esta usa «${section.composition.template}».`,
      },
    ]
  })
}

// The publish rules over what a visitor will see, with each path pointing at
// the face in the document as written, not its place in the face order.
export function publishRuleIssues(content: SiteContent): Issue[] {
  const visible = visibleContent(content)
  return publishIssues(visible).map((issue) => {
    const path = [...issue.path]
    if (path[0] === 'sections' && typeof path[1] === 'number') {
      const id = visible.sections[path[1]]?.id
      const index = content.sections.findIndex((section) => section.id === id)
      path[1] = index === -1 ? id ?? path[1] : index
    }
    return { path, message: issue.message }
  })
}

// The shape and the publish rules together, as production requires them.
export const PublishableSiteContentSchema = SiteContentSchema.check(z.superRefine((content, context) => {
  for (const issue of publishRuleIssues(content)) context.addIssue({ code: 'custom', path: issue.path, message: issue.message })
}))
