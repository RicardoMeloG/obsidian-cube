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

export const CUBE_SECTIONS: CubeSection[] = [
  {
    id: 'agentic',
    label: 'AGENTIC',
    title: 'Agentic Product Engineering',
    eyebrow: 'Positioning',
    summary: 'AI-assisted product development shaped by specs, fast prototypes, and production-minded iteration.',
    features: [
      { glyph: 'eye', label: 'Practical Vision', description: 'Agents that turn intent into measurable results.' },
      { glyph: 'shield', label: 'Verifiable Systems', description: 'Real constraints, observability, auditable decisions.' },
      { glyph: 'rocket', label: 'Design to Production', description: 'Fast prototypes to reliable, scalable solutions.' },
      { glyph: 'chart', label: 'Real Impact', description: 'Value measurable in business and in people.' },
    ],
    flowTitle: 'AGENTIC FLOW',
    flow: [
      { label: 'SPECIFY', description: 'Define objective, context, and verifiable constraints.' },
      { label: 'PROTOTYPE', description: 'Build fast, iterate with real data, validate assumptions.' },
      { label: 'VERIFY', description: 'Measure, test, ensure the agent meets its purpose.' },
      { label: 'SHIP', description: 'Deploy with monitoring, traceability, and continuous control.' },
    ],
    ctaPrimary: { label: 'EXPLORE APPROACH' },
    ctaSecondary: { label: 'VIEW METHODOLOGY' },
  },
  {
    id: 'products',
    label: 'PRODUCTS',
    title: 'Public Products',
    eyebrow: 'Open Source',
    summary: 'Selected tools and product experiments that demonstrate execution, safety, and usability.',
    features: [
      { glyph: 'rocket', label: 'Main Repository', description: 'The project that best shows current direction.' },
      { glyph: 'spark', label: 'This Prototype', description: 'The site itself as evidence of the workflow.' },
      { glyph: 'eye', label: 'Design Judgment', description: 'Choices made under real constraints, not on a whiteboard.' },
      { glyph: 'chart', label: 'Maintainability', description: 'Code that survives past the demo.' },
    ],
    flowTitle: 'RELEASE FLOW',
    flow: [
      { label: 'SCOPE', description: 'Pick what is worth shipping and what is not.' },
      { label: 'BUILD', description: 'Working software over polished promises.' },
      { label: 'HARDEN', description: 'Tests, docs, error paths, observability.' },
      { label: 'PUBLISH', description: 'Open the artifact and own its evolution.' },
    ],
    ctaPrimary: { label: 'OPEN REPOSITORY' },
    ctaSecondary: { label: 'VIEW PROJECTS' },
  },
  {
    id: 'systems',
    label: 'SYSTEMS',
    title: 'Production Systems',
    eyebrow: 'Architecture',
    summary: 'Legacy modernization, databases, architecture, cloud direction, and real operational constraints.',
    features: [
      { glyph: 'shield', label: 'Legacy Modernization', description: 'Move forward without breaking what already works.' },
      { glyph: 'spark', label: 'Data and Integrations', description: 'Schemas, contracts, and reliable boundaries.' },
      { glyph: 'rocket', label: 'Cloud Direction', description: 'A pragmatic path toward serverless and managed services.' },
      { glyph: 'chart', label: 'Operational Continuity', description: 'Uptime, runbooks, and humane on-call.' },
    ],
    flowTitle: 'DELIVERY FLOW',
    flow: [
      { label: 'OBSERVE', description: 'See the real system before changing it.' },
      { label: 'CONTAIN', description: 'Stabilize the riskiest seams first.' },
      { label: 'EVOLVE', description: 'Incremental rewrites under feature flags.' },
      { label: 'OPERATE', description: 'Logs, metrics, traces, and clear ownership.' },
    ],
    ctaPrimary: { label: 'VIEW ARCHITECTURE' },
    ctaSecondary: { label: 'CASE STUDIES' },
  },
  {
    id: 'security',
    label: 'SECURITY',
    title: 'Security Mindset',
    eyebrow: 'Risk Control',
    summary: 'Secure defaults, MFA, rate limiting, validation, and production risk awareness.',
    features: [
      { glyph: 'lock', label: 'Secure Defaults', description: 'Least privilege, no secrets in repos, signed releases.' },
      { glyph: 'shield', label: 'Strong Auth', description: 'MFA, short-lived tokens, audit trail.' },
      { glyph: 'eye', label: 'Input Validation', description: 'Schema-first inputs, rate limits, abuse controls.' },
      { glyph: 'chart', label: 'Risk Proportion', description: 'Controls matched to actual blast radius.' },
    ],
    flowTitle: 'CONTROLS FLOW',
    flow: [
      { label: 'INVENTORY', description: 'Know what you protect and why.' },
      { label: 'HARDEN', description: 'MFA, secrets, dependency hygiene, WAF where it pays.' },
      { label: 'MONITOR', description: 'Detect abuse, log carefully, avoid sensitive content in logs.' },
      { label: 'RESPOND', description: 'Rotate, contain, write a clean post-mortem.' },
    ],
    ctaPrimary: { label: 'VIEW CONTROLS' },
    ctaSecondary: { label: 'THREAT MODEL' },
  },
  {
    id: 'research',
    label: 'RESEARCH',
    title: 'Independent Research',
    eyebrow: 'Research',
    summary: 'Philosophy applied to AI: separating output from truth, representation from reality, and behavior from agency.',
    features: [
      { glyph: 'eye', label: 'Truth', description: 'Criteria for representations that stay accountable to reality.' },
      { glyph: 'spark', label: 'Meaning', description: 'Understanding as reconstruction and experiential injection.' },
      { glyph: 'shield', label: 'Purpose', description: 'Separating own direction from borrowed purpose.' },
      { glyph: 'chart', label: 'AI', description: 'Taxonomies that avoid confusing simulation with subjectivity.' },
    ],
    researchConcepts: [
      {
        key: 'truth',
        label: 'Truth as Being',
        axis: 'Truth',
        summary: 'Output quality is not the same as truth.',
        detail:
          'The research line separates being from its representations. An answer can be useful, fluent, or convincing, but it gains strength only when it remains accountable to what it claims to represent.',
      },
      {
        key: 'representation',
        label: 'Fidelity',
        axis: 'Representation',
        summary: 'Not every representation carries the same weight.',
        detail:
          'Fidelity is not measured by beauty, authority, or immediate utility, but by the effective relation between representation, experience, and contrast with being.',
      },
      {
        key: 'meaning',
        label: 'Meaning',
        axis: 'Reconstruction',
        summary: 'Meaning does not live inside the sign.',
        detail:
          'A representation means something when a system can reconstruct what the representation does not contain by itself. This separates language processing from understanding.',
      },
      {
        key: 'purpose',
        label: 'Own Purpose',
        axis: 'Agency',
        summary: 'Goal-directed behavior is not enough for owned direction.',
        detail:
          'The central question for agents and AI is not only what they do, but where their direction comes from: prompt, reward, external mission, or internal appropriation.',
      },
      {
        key: 'experience',
        label: 'Experiential Injection',
        axis: 'Understanding',
        summary: 'Understanding requires activatable experience.',
        detail:
          'A human injects lived experience into signs and situations. A model can operate over patterns of human experience without having its own experience to activate.',
      },
      {
        key: 'simulation',
        label: 'Simulated Consciousness',
        axis: 'AI',
        summary: 'Capability, agency, and subjectivity are not the same.',
        detail:
          'The taxonomy orders systems by distance from borrowed purpose, avoiding the mistake of assigning consciousness only because behavior appears human.',
      },
    ],
    flowTitle: 'INQUIRY FLOW',
    flow: [
      { label: 'BEING', description: 'Separate reality, manifestation, and narrative.' },
      { label: 'REPRESENT', description: 'Measure fidelity, trace, and mediation.' },
      { label: 'MEAN', description: 'Explain reconstruction and experiential injection.' },
      { label: 'DIRECT', description: 'Evaluate borrowed purpose, agency, and simulation.' },
    ],
    ctaPrimary: { label: 'VIEW SYSTEM' },
    ctaSecondary: { label: 'CONCEPTS' },
    detail: {
      title: 'Philosophical system',
      summary:
        'The research works as a design criterion for AI: separating output from truth, representation from reality, meaning from processing, and agency from borrowed purpose.',
      points: [
        'Truth as Being: an output matters only if it remains accountable to reality.',
        'VO -> M -> D -> Ri -> R: a conceptual pipeline for reality, data, internal representation, and report.',
        'Representation fidelity: not every useful answer represents well what it claims to represent.',
        'Meaning as reconstruction: a sign requires the system to complete what the sign does not contain.',
        'Own purpose: the question is not whether behavior is directed, but where direction comes from.',
        'Simulated consciousness: technical capability, agency, and subjectivity must be evaluated separately.',
      ],
    },
  },
  {
    id: 'contact',
    label: 'CONTACT',
    title: 'Contact',
    eyebrow: 'Reach Out',
    summary: 'Professional links and contact channels for collaboration and opportunities.',
    features: [
      { glyph: 'spark', label: 'Public Name', description: 'Ricardo Hernan Melo Gallardo.' },
      { glyph: 'rocket', label: 'GitHub', description: 'Open-source work and this prototype.' },
      { glyph: 'eye', label: 'LinkedIn', description: 'Professional context and history.' },
      { glyph: 'shield', label: 'Email', description: 'Direct, low-noise channel for opportunities.' },
    ],
    flowTitle: 'CHANNELS',
    flow: [
      { label: 'OPEN', description: 'Inbox is open for serious collaboration.' },
      { label: 'BRIEF', description: 'Send context: role, scope, constraints.' },
      { label: 'MEET', description: 'Short call to align on fit and scope.' },
      { label: 'COMMIT', description: 'Move only when both sides see the value.' },
    ],
    ctaPrimary: { label: 'WRITE AN EMAIL' },
    ctaSecondary: { label: 'OPEN GITHUB' },
  },
]
