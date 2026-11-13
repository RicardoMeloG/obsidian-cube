import { z } from 'zod'
import type { ZodMiniType } from 'zod/mini'
import { ProfileContentSchema, profileRuleIssues } from '../../src/kernel/profileContent'
import type { ProfileContent } from '../../src/kernel/profileContent'
import { publishRuleIssues } from '../../src/kernel/publishRules'
import type { Issue } from '../../src/kernel/publishRules'
import { SiteContentSchema } from '../../src/kernel/siteContent'
import type { SiteContent } from '../../src/kernel/siteContent'
import { VisualContentSchema } from '../../src/kernel/visualContent'

// The editable documents. Each maps to the kernel schema the frontend
// renders with (the profile: the build, for the layer for machines; ADR 009),
// its publish rules (layout budgets, links, no placeholders; blocking
// or warning by APP_ENV), its published file and a committed example used as
// the first-load fallback. This whitelist is also the path-traversal guard: only
// these ids ever reach the filesystem.
export type DocId = 'site.en' | 'site.es' | 'visual' | 'profile.en' | 'profile.es'

export type DocDescriptor = {
  id: DocId
  label: string
  file: string
  example: string
  schema: ZodMiniType
  // Called with data the schema accepted.
  rules?: (data: unknown) => Issue[]
}

const siteRules = (data: unknown) => publishRuleIssues(data as SiteContent)
const profileRules = (data: unknown) => profileRuleIssues(data as ProfileContent)

export const DOCS: Record<DocId, DocDescriptor> = {
  'site.en': {
    id: 'site.en',
    label: 'Contenido — Inglés (EN)',
    file: 'site.en.json',
    example: 'site.example.en.json',
    schema: SiteContentSchema,
    rules: siteRules,
  },
  'site.es': {
    id: 'site.es',
    label: 'Contenido — Español (ES)',
    file: 'site.es.json',
    example: 'site.example.es.json',
    schema: SiteContentSchema,
    rules: siteRules,
  },
  visual: {
    id: 'visual',
    label: 'Presentación — fondos y acentos',
    file: 'visual.json',
    example: 'visual.example.json',
    schema: VisualContentSchema,
  },
  'profile.en': {
    id: 'profile.en',
    label: 'Perfil para máquinas — Inglés (EN)',
    file: 'profile.en.json',
    example: 'profile.example.en.json',
    schema: ProfileContentSchema,
    rules: profileRules,
  },
  'profile.es': {
    id: 'profile.es',
    label: 'Perfil para máquinas — Español (ES)',
    file: 'profile.es.json',
    example: 'profile.example.es.json',
    schema: ProfileContentSchema,
    rules: profileRules,
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
