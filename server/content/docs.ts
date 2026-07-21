import type { ZodType } from 'zod'
import { SiteContentSchema } from '../../src/features/premium-cube/content/siteContent'
import { VisualContentSchema } from '../../src/features/premium-cube/content/visualContent'

// The three editable documents. Each maps to the SAME Zod schema the frontend
// validates against, plus its published file and a committed example used as the
// first-load fallback. This whitelist is also the path-traversal guard: only
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
    schema: SiteContentSchema,
  },
  'site.es': {
    id: 'site.es',
    label: 'Contenido — Español (ES)',
    file: 'site.es.json',
    example: 'site.example.es.json',
    schema: SiteContentSchema,
  },
  visual: {
    id: 'visual',
    label: 'Presentación — fondos y acentos',
    file: 'visual.json',
    example: 'visual.example.json',
    schema: VisualContentSchema,
  },
}

export function isDocId(value: string): value is DocId {
  return Object.prototype.hasOwnProperty.call(DOCS, value)
}
