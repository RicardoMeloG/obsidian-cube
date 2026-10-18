// Face catalog of the content kernel: the six faces and their order. Data
// only. A face's copy is content
// (public/content/site.*.json) and its accent and world are presentation
// (public/content/visual.json); both are validated by this kernel, and their
// types are derived from its schemas (siteContent.ts, visualContent.ts).
export type FaceId = 'agentic' | 'products' | 'systems' | 'security' | 'research' | 'contact'

export const FACE_ORDER: FaceId[] = ['agentic', 'products', 'systems', 'security', 'research', 'contact']
