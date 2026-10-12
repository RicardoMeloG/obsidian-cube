// Content contract shared by the site, its build-time SEO and the admin.
// Pure: no DOM, no React; loading and locale detection live in
// src/features/content.
import { z } from 'zod'
import exampleEn from '../../public/content/site.example.en.json'
import exampleEs from '../../public/content/site.example.es.json'
import { CUBE_FACE_ORDER, FEATURE_GLYPHS } from './faces'
import type { CubeSection, CubeSectionId, FeatureGlyphId } from './faces'

export type SiteLocale = 'en' | 'es'

const SectionIdSchema = z.enum(CUBE_FACE_ORDER as [CubeSectionId, ...CubeSectionId[]])
const FeatureGlyphSchema = z.enum(FEATURE_GLYPHS as unknown as [FeatureGlyphId, ...FeatureGlyphId[]])

// Rich prose fields are rendered through `sanitizeRichText` (inline HTML
// whitelist) via the <RichText/> component. Still a plain string at the schema
// level — the sanitization boundary lives at render time, not validation.
const RichTextSchema = z.string().min(1)

const CtaSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1).optional(),
})

const LinkSchema = z.object({
  label: z.string().min(1),
  description: RichTextSchema.optional(),
  href: z.string().min(1).optional(),
})

const FeatureSchema = z.object({
  glyph: FeatureGlyphSchema,
  label: z.string().min(1),
  description: RichTextSchema,
})

const FlowStepSchema = z.object({
  label: z.string().min(1),
  description: RichTextSchema,
})

const ResearchConceptSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  axis: z.string().min(1),
  summary: RichTextSchema,
  detail: RichTextSchema,
})

const SiteSectionSchema = z.object({
  id: SectionIdSchema,
  label: z.string().min(1),
  title: z.string().min(1),
  eyebrow: z.string().min(1).optional(),
  summary: RichTextSchema,
  intro: RichTextSchema.optional(),
  highlights: z.array(RichTextSchema).optional(),
  proofPoints: z.array(RichTextSchema).optional(),
  links: z.array(LinkSchema).optional(),
  cta: CtaSchema.optional(),
  features: z.array(FeatureSchema).optional(),
  flowTitle: z.string().min(1).optional(),
  flow: z.array(FlowStepSchema).optional(),
  ctaPrimary: CtaSchema.optional(),
  ctaSecondary: CtaSchema.optional(),
  detail: z
    .object({
      title: z.string().min(1),
      summary: RichTextSchema,
      points: z.array(RichTextSchema).optional(),
      links: z.array(LinkSchema).optional(),
    })
    .optional(),
  researchConcepts: z.array(ResearchConceptSchema).optional(),
})

export const SiteContentSchema = z.object({
  locale: z.enum(['en', 'es']),
  identity: z.object({
    displayName: z.string().min(1),
    fullName: z.string().min(1),
    handle: z.string().min(1),
    role: z.string().min(1),
    // One line under the role, e.g. "AI Engineer · LLM agents · Python · AWS".
    keywords: z.string().min(1).optional(),
  }),
  seo: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    // Public origin of the deployed site (canonical and og:url), no trailing slash.
    siteUrl: z.string().url().optional(),
    // Share preview image: a path under public/ or an absolute URL.
    image: z.string().min(1).optional(),
  }),
  hero: z.object({
    headline: z.string().min(1),
    summary: RichTextSchema,
  }),
  sections: z.array(SiteSectionSchema).length(CUBE_FACE_ORDER.length),
})

export type SiteContent = z.infer<typeof SiteContentSchema>
export type SiteSection = SiteContent['sections'][number]

// The committed example is the one set of defaults: it renders before the
// published content arrives, replaces it when it is missing or invalid, and
// fills fields a published face leaves empty, in the same locale.
const DEFAULT_CONTENT: Record<SiteLocale, SiteContent> = {
  en: SiteContentSchema.parse(exampleEn),
  es: SiteContentSchema.parse(exampleEs),
}

export function getDefaultSiteContent(locale: SiteLocale): SiteContent {
  return DEFAULT_CONTENT[locale]
}

export function normalizeSections(sections: SiteSection[], locale: SiteLocale): CubeSection[] {
  const defaults = DEFAULT_CONTENT[locale].sections

  return CUBE_FACE_ORDER.map((id) => {
    const section = sections.find((candidate) => candidate.id === id)
    const fallback = defaults.find((candidate) => candidate.id === id)!

    return {
      id,
      label: section?.label ?? fallback.label,
      title: section?.title ?? fallback.title,
      eyebrow: section?.eyebrow ?? fallback.eyebrow ?? '',
      summary: section?.summary ?? fallback.summary,
      intro: section?.intro,
      highlights: section?.highlights,
      proofPoints: section?.proofPoints,
      links: section?.links,
      cta: section?.cta,
      features: section?.features ?? fallback.features,
      flowTitle: section?.flowTitle ?? fallback.flowTitle,
      flow: section?.flow ?? fallback.flow,
      ctaPrimary: section?.ctaPrimary ?? fallback.ctaPrimary,
      ctaSecondary: section?.ctaSecondary ?? fallback.ctaSecondary,
      detail: section?.detail ?? fallback.detail,
      researchConcepts: section?.researchConcepts ?? fallback.researchConcepts,
    }
  })
}
