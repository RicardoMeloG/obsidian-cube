import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { CubeSection, CubeSectionDetail, CubeSectionId, CubeSectionResearchConcept, FeatureGlyphId } from './cubeSections'
import type { ResolvedCubeSection } from './content/visualContent'
import type { SiteLocale } from './content/siteContent'
import { RichText } from './content/RichText'

type SidePanelsProps = {
  activeSection: ResolvedCubeSection
  locale: SiteLocale
  onOpenDetail: (detail?: CubeSectionDetail) => void
  transitionState?: 'idle' | 'exiting' | 'entering'
}

type GlyphProps = {
  glyph: FeatureGlyphId
}

function FeatureGlyph({ glyph }: GlyphProps) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (glyph) {
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 4.5 6v6c0 4.5 3.2 7.5 7.5 9 4.3-1.5 7.5-4.5 7.5-9V6L12 3Z" />
          <path d="m8.5 12 2.5 2.5L16 9.5" />
        </svg>
      )
    case 'rocket':
      return (
        <svg {...common}>
          <path d="M5 19c0-4 1-7 4-10s6-4 10-4c0 4-1 7-4 10s-6 4-10 4Z" />
          <circle cx="14.5" cy="9.5" r="1.6" />
          <path d="M5 19s1.5-.5 3-2M9 14l1 1" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...common}>
          <path d="M3.5 20.5h17" />
          <path d="M6 17V11M10 17V7M14 17V13M18 17V9" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="9" rx="1.6" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          <circle cx="12" cy="15.5" r="1.2" />
        </svg>
      )
    default:
      return null
  }
}

const CHEVRON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
)

function createResearchConceptDetail(concept: CubeSectionResearchConcept): CubeSectionDetail {
  return {
    title: concept.label,
    summary: concept.summary,
    points: [concept.detail],
    links: [
      {
        label: concept.axis,
        description: 'Concepto curado desde el sistema filosófico privado.',
      },
    ],
  }
}

export function SidePanels({
  activeSection,
  locale,
  onOpenDetail,
  transitionState = 'idle',
}: SidePanelsProps) {
  const eyebrowLabel = getEyebrowLabel(activeSection, locale)
  const titleLines = useMemo(() => splitTitleIntoTwoLines(activeSection.title), [activeSection.title])
  // Per-face accent: exposed as a CSS variable so the title picks up the section
  // hue. Resolved from visual.json (falls back to SECTION_ACCENTS defaults).
  const accentStyle = { '--section-accent': activeSection.accent } as CSSProperties
  const flowCountLabel = useMemo(
    () => String(activeSection.flow?.length ?? 0).padStart(2, '0'),
    [activeSection.flow],
  )
  const renderCta = (cta: CubeSection['ctaPrimary'], modifier: string) => {
    if (!cta) return null

    if (cta.href) {
      return (
        <a
          className={`side-panels__cta ${modifier}`}
          href={cta.href}
          rel="noreferrer"
          target={cta.href.startsWith('http') ? '_blank' : undefined}
        >
          <span>{cta.label}</span>
          {CHEVRON}
        </a>
      )
    }

    return (
      <button className={`side-panels__cta ${modifier}`} type="button" onClick={() => onOpenDetail()}>
        <span>{cta.label}</span>
        {CHEVRON}
      </button>
    )
  }

  return (
    <div className={`side-panels is-${transitionState}`} style={accentStyle} data-section={activeSection.id}>
      <aside className="side-panels__rail side-panels__rail--left" key={`L-${activeSection.id}`}>
        <p className="side-panels__eyebrow">
          <span aria-hidden />
          {eyebrowLabel}
        </p>
        <h1 className="side-panels__title">
          {titleLines[1] ? (
            <>
              <span className="side-panels__title-line">{titleLines[0]}</span>
              <span className="side-panels__title-line side-panels__title-line--accent">{titleLines[1]}</span>
            </>
          ) : (
            <span className="side-panels__title-line side-panels__title-line--accent">{titleLines[0]}</span>
          )}
        </h1>
        <RichText as="p" className="side-panels__summary" html={activeSection.summary} />

        {activeSection.features && activeSection.features.length > 0 && (
          activeSection.id === 'research' && activeSection.researchConcepts?.length ? (
            <div className="side-panels__research-map" aria-label="Research concepts">
              {activeSection.researchConcepts.slice(0, 4).map((concept) => (
                <button
                  className="side-panels__research-node"
                  key={concept.key}
                  type="button"
                  onClick={() => onOpenDetail(createResearchConceptDetail(concept))}
                >
                  <span>{concept.axis}</span>
                  <strong>{concept.label}</strong>
                  <RichText as="small" html={concept.summary} />
                </button>
              ))}
            </div>
          ) : (
            <ul className="side-panels__features">
              {activeSection.features.map((feature) => (
                <li key={feature.label} className="side-panels__feature">
                  <span className="side-panels__feature-glyph">
                    <FeatureGlyph glyph={feature.glyph} />
                  </span>
                  <div className="side-panels__feature-body">
                    <strong>{feature.label}</strong>
                    <RichText as="p" html={feature.description} />
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {renderCta(activeSection.ctaPrimary, 'side-panels__cta--primary')}
      </aside>

      <aside className="side-panels__rail side-panels__rail--right" key={`R-${activeSection.id}`}>
        <header className="side-panels__rail-header">
          <span>{activeSection.flowTitle ?? activeSection.label}</span>
          <strong aria-hidden>{flowCountLabel}</strong>
        </header>

        {activeSection.flow && activeSection.flow.length > 0 && (
          <ol className="side-panels__flow">
            {activeSection.flow.map((step, index) => (
              <li key={step.label} className="side-panels__flow-step">
                <span className="side-panels__flow-index" aria-hidden>{String(index + 1).padStart(2, '0')}</span>
                <div className="side-panels__flow-body">
                  <strong>{step.label}</strong>
                  <RichText as="p" html={step.description} />
                </div>
              </li>
            ))}
          </ol>
        )}

        {renderCta(activeSection.ctaSecondary, 'side-panels__cta--secondary')}
      </aside>
    </div>
  )
}

function getEyebrowLabel(section: CubeSection, locale: SiteLocale) {
  if (locale !== 'es') {
    return section.eyebrow
  }

  const labels: Record<CubeSectionId, string> = {
    agentic: 'INGENIERÍA AGÉNTICA',
    products: 'PRODUCTO ABIERTO',
    systems: 'ARQUITECTURA',
    security: 'CONTROL DE RIESGO',
    research: 'INVESTIGACIÓN',
    contact: 'CONTACTO',
  }

  return labels[section.id]
}

function splitTitleIntoTwoLines(title: string): [string, string?] {
  const trimmed = title.trim()
  const words = trimmed.split(/\s+/)
  if (words.length === 1) return [trimmed]

  let best = words.length - 1
  let bestDelta = Number.POSITIVE_INFINITY
  for (let i = 1; i < words.length; i += 1) {
    const left = words.slice(0, i).join(' ').length
    const right = words.slice(i).join(' ').length
    const delta = Math.abs(left - right)
    if (delta < bestDelta) {
      bestDelta = delta
      best = i
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}
