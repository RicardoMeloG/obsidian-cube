import { z } from 'zod'
import type { ZodType } from 'zod'
import { PublishableSiteContentSchema } from '../../src/kernel/publishRules'
import { VisualContentSchema } from '../../src/kernel/visualContent'

// The three editable documents. Each maps to the kernel schema the frontend
// renders with — for the site documents, plus the publish rules (layout budgets,
// links, no placeholders) — its published file and a committed example used as
// the first-load fallback. This whitelist is also the path-traversal guard: only
// these ids ever reach the filesystem.
export type DocId = 'site.en' | 'site.es' | 'visual'

export type DocDescriptor = {
  id: DocId
  label: string
  file: string
  example: string
  schema: ZodType
}

export const DOCS: Record<DocId, DocDescriptor> = {
  'site.en': {
    id: 'site.en',
    label: 'Contenido — Inglés (EN)',
    file: 'site.en.json',
    example: 'site.example.en.json',
    schema: PublishableSiteContentSchema,
  },
  'site.es': {
    id: 'site.es',
    label: 'Contenido — Español (ES)',
    file: 'site.es.json',
    example: 'site.example.es.json',
    schema: PublishableSiteContentSchema,
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
// its form (spec 011, AD-04). The publish rules' refinements do not travel:
// the server still validates with the Zod schema.
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
