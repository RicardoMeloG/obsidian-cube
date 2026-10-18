import { z } from 'zod'
import type { ZodType } from 'zod'
import { publishRuleIssues } from '../../src/kernel/publishRules'
import type { Issue } from '../../src/kernel/publishRules'
import { SiteContentSchema } from '../../src/kernel/siteContent'
import type { SiteContent } from '../../src/kernel/siteContent'
import { VisualContentSchema } from '../../src/kernel/visualContent'

// The three editable documents. Each maps to the kernel schema the frontend
// renders with, the publish rules for the site documents (layout budgets,
// links, no placeholders; blocking or warning by APP_ENV), its
// published file and a committed example used as
// the first-load fallback. This whitelist is also the path-traversal guard: only
// these ids ever reach the filesystem.
export type DocId = 'site.en' | 'site.es' | 'visual'

export type DocDescriptor = {
  id: DocId
  label: string
  file: string
  example: string
  schema: ZodType
  rules?: (data: SiteContent) => Issue[]
}

export const DOCS: Record<DocId, DocDescriptor> = {
  'site.en': {
    id: 'site.en',
    label: 'Contenido — Inglés (EN)',
    file: 'site.en.json',
    example: 'site.example.en.json',
    schema: SiteContentSchema,
    rules: publishRuleIssues,
  },
  'site.es': {
    id: 'site.es',
    label: 'Contenido — Español (ES)',
    file: 'site.es.json',
    example: 'site.example.es.json',
    schema: SiteContentSchema,
    rules: publishRuleIssues,
  },
  visual: {
    id: 'visual',
    label: 'Presentación — fondos y acentos',
    file: 'visual.json',
    example: 'visual.example.json',
    schema: VisualContentSchema,
  },
}

// The document's schema as JSON Schema, from which the admin page generates
// its form (spec 011, AD-04). The publish rules do not travel: the server
// applies them when validating.
export function formSchema(id: DocId) {
  return z.toJSONSchema(DOCS[id].schema)
}

// The other language of a site document, for the cross-language warning.
export function otherLanguage(id: DocId): DocId | null {
  if (id === 'site.en') return 'site.es'
  if (id === 'site.es') return 'site.en'
  return null
}

export function isDocId(value: string): value is DocId {
  return Object.prototype.hasOwnProperty.call(DOCS, value)
}
