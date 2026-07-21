import { z } from 'zod'
import { CUBE_FACE_ORDER, CUBE_SECTIONS, FEATURE_GLYPHS } from '../cubeSections'
import type { CubeSection, CubeSectionId, FeatureGlyphId } from '../cubeSections'

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
  }),
  seo: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
  }),
  hero: z.object({
    headline: z.string().min(1),
    summary: RichTextSchema,
  }),
  sections: z.array(SiteSectionSchema).length(CUBE_FACE_ORDER.length),
})

export type SiteContent = z.infer<typeof SiteContentSchema>
export type SiteSection = SiteContent['sections'][number]

const DEFAULT_CONTENT: Record<SiteLocale, SiteContent> = {
  en: {
    locale: 'en',
    identity: {
      displayName: 'Portfolio Owner',
      fullName: 'Portfolio Owner',
      handle: 'your-handle',
      role: 'Agentic Product Engineer',
    },
    seo: {
      title: 'Agentic Portfolio | Agentic Product Engineer',
      description:
        'Open-source agentic portfolio prototype for AI-assisted product development, production systems, security, and research.',
    },
    hero: {
      headline: 'Agentic Product Engineer building AI-assisted products from real-world systems experience.',
      summary:
        'A public prototype for product building with agents, production engineering discipline, open-source tools, and independent research.',
    },
    sections: CUBE_SECTIONS.map(({ id, label, title, summary }) => ({ id, label, title, summary })),
  },
  es: {
    locale: 'es',
    identity: {
      displayName: 'Portfolio Owner',
      fullName: 'Portfolio Owner',
      handle: 'your-handle',
      role: 'Ingeniero de Productos Agénticos',
    },
    seo: {
      title: 'Portfolio Agéntico | Ingeniero de Productos Agénticos',
      description:
        'Prototipo open source de portfolio agéntico para desarrollo asistido por IA, sistemas productivos, seguridad e investigación.',
    },
    hero: {
      headline:
        'Ingeniero de productos agénticos construyendo software asistido por IA desde experiencia real en sistemas productivos.',
      summary:
        'Un prototipo público para construir productos con agentes, criterio de producción, herramientas open source e investigación independiente.',
    },
    sections: [
      {
        id: 'agentic',
        label: 'AGÉNTICO',
        title: 'Ingeniería de Productos Agénticos',
        summary:
          'Construcción de productos con agentes de IA, especificaciones, prototipos rápidos e iteración con criterio productivo.',
      },
      {
        id: 'products',
        label: 'PRODUCTOS',
        title: 'Productos Públicos',
        summary: 'Herramientas open source y experimentos de producto que demuestran ejecución, seguridad y usabilidad.',
      },
      {
        id: 'systems',
        label: 'SISTEMAS',
        title: 'Sistemas Productivos',
        summary: 'Experiencia en modernización legacy, bases de datos, arquitectura y restricciones operativas reales.',
      },
      {
        id: 'security',
        label: 'SEGURIDAD',
        title: 'Criterio de Seguridad',
        summary: 'Defaults seguros, MFA, rate limiting, validación y conciencia de riesgo productivo.',
      },
      {
        id: 'research',
        label: 'INVESTIGACIÓN',
        title: 'Investigación Independiente',
        summary: 'Trabajo sobre IA, pensamiento, verdad, representación, papers y escritura de largo aliento.',
      },
      {
        id: 'contact',
        label: 'CONTACTO',
        title: 'Contacto',
        summary: 'Links profesionales y canales de contacto para colaboración y oportunidades.',
      },
    ],
  },
}

export function normalizeSections(sections: SiteSection[]): CubeSection[] {
  return CUBE_FACE_ORDER.map((id) => {
    const section = sections.find((candidate) => candidate.id === id)
    const fallback = CUBE_SECTIONS.find((candidate) => candidate.id === id)!

    return {
      id,
      label: section?.label ?? fallback.label,
      title: section?.title ?? fallback.title,
      eyebrow: section?.eyebrow ?? fallback.eyebrow,
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

export function resolveSiteLocale(search = window.location.search, browserLanguage = navigator.language): SiteLocale {
  const requestedLocale = new URLSearchParams(search).get('lang')

  if (requestedLocale === 'en' || requestedLocale === 'es') {
    return requestedLocale
  }

  return browserLanguage.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function getDefaultSiteContent(locale: SiteLocale) {
  return DEFAULT_CONTENT[locale]
}

export async function loadSiteContent(locale: SiteLocale): Promise<SiteContent> {
  const contentPaths = [`/content/site.${locale}.json`, `/content/site.example.${locale}.json`]

  for (const contentPath of contentPaths) {
    try {
      const response = await fetch(contentPath, { cache: 'no-store' })

      if (!response.ok) {
        continue
      }

      return SiteContentSchema.parse(await response.json())
    } catch (error) {
      console.warn(`Could not load site content from ${contentPath}`, error)
    }
  }

  return getDefaultSiteContent(locale)
}
