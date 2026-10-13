// Face catalog of the content kernel: the six faces, their order and the
// glyphs a feature may use. Data only. A face's copy is content
// (public/content/site.*.json) and its accent and world are presentation
// (public/content/visual.json); both are validated by this kernel, and their
// types are derived from its schemas (siteContent.ts, visualContent.ts).
export type FaceId = 'agentic' | 'products' | 'systems' | 'security' | 'research' | 'contact'

export const FACE_ORDER: FaceId[] = ['agentic', 'products', 'systems', 'security', 'research', 'contact']

export const FEATURE_GLYPHS = ['eye', 'shield', 'rocket', 'chart', 'spark', 'lock'] as const
export type FeatureGlyphId = (typeof FEATURE_GLYPHS)[number]
