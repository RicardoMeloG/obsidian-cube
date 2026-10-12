// Face catalog of the content kernel: ids, order, glyph ids, default accents
// and the section shape the interface renders. Data and types only; the copy
// of each face lives in the content documents (example: public/content).
export type CubeSectionId = 'agentic' | 'products' | 'systems' | 'security' | 'research' | 'contact'

export const CUBE_FACE_ORDER: CubeSectionId[] = ['agentic', 'products', 'systems', 'security', 'research', 'contact']

// Per-face accent palette (PoC). A muted, harmonized set over the obsidian
// field — each face gets a quiet distinctive hue for its title and cube glyph.
// Recovered from an earlier iteration of the prototype and re-tuned
// toward the documented obsidian tokens (ice / copper / steel / mint / violet /
// sand). Per-face accent + inner glyph is the rule since ADR 003
// (docs/decisions/003-per-face-accent-and-glyph.md); the shared frame never
// varies. These are the defaults; public/content/visual.json overrides them.
export const SECTION_ACCENTS: Record<CubeSectionId, string> = {
  agentic: '#b8aeff', // violeta — la cara de entrada (plato fuerte): violeta
  // monocromo sobre el fondo violeta = la lectura más premium del sistema.
  products: '#c08b5a', // cobre / oro
  systems: '#8bb4dd', // azul acero — frío y técnico (arquitectura / cloud / AWS),
  // con más carácter que el gris anterior y distinto del lavanda de research.
  security: '#89d6c7', // verde menta
  research: '#9fa9ef', // lavanda-índigo — más azulado y luminoso que la entrada,
  // para despegarse del fondo violeta y no chocar con la cara de Agéntico.
  contact: '#f0d2b4', // dorado arena
}

export const FEATURE_GLYPHS = ['eye', 'shield', 'rocket', 'chart', 'spark', 'lock'] as const
export type FeatureGlyphId = (typeof FEATURE_GLYPHS)[number]

export type CubeSectionFeature = {
  glyph: FeatureGlyphId
  label: string
  description: string
}

export type CubeSectionFlowStep = {
  label: string
  description: string
}

export type CubeSectionCta = {
  label: string
  href?: string
}

export type CubeSectionDetail = {
  title: string
  summary: string
  points?: string[]
  links?: {
    label: string
    description?: string
    href?: string
  }[]
}

export type CubeSectionResearchConcept = {
  key: string
  label: string
  axis: string
  summary: string
  detail: string
}

export type CubeSection = {
  id: CubeSectionId
  label: string
  title: string
  eyebrow: string
  summary: string
  intro?: string
  highlights?: string[]
  proofPoints?: string[]
  links?: {
    label: string
    description?: string
    href?: string
  }[]
  cta?: CubeSectionCta
  features?: CubeSectionFeature[]
  flowTitle?: string
  flow?: CubeSectionFlowStep[]
  ctaPrimary?: CubeSectionCta
  ctaSecondary?: CubeSectionCta
  detail?: CubeSectionDetail
  researchConcepts?: CubeSectionResearchConcept[]
}
