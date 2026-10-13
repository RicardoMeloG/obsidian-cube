import { useId, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { CubeSection, CubeSectionDetail, CubeSectionResearchConcept, FeatureGlyphId } from '../../kernel/faces'
import type { ResolvedCubeSection } from '../../kernel/visualContent'
import { RichText } from '../content/RichText'
import { cx } from '../../ui/cx'
import { Eyebrow } from '../../ui/Eyebrow'
import { GlyphTile } from '../../ui/GlyphTile'
import { NumberBadge } from '../../ui/NumberBadge'
import { PillButton } from '../../ui/PillButton'
import './SidePanels.css'

type SidePanelsProps = {
  activeSection: ResolvedCubeSection
  // `trigger` is the control that opened the detail; the dialog returns focus to it on close.
  onOpenDetail: (detail?: CubeSectionDetail, trigger?: HTMLElement) => void
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

// Layout of the two rails around the cube (desktop grid, stacked flow), by
// layout mode (src/styles/tokens.css). `side-panels`, `side-panels__rail` and
// `side-panels__cta` are hooks for the intro, the choreography and the layout
// check (SidePanels.css, App.css, scripts/check-layout.mjs).
const PANELS = cx(
  'side-panels accent-scope pointer-events-none absolute inset-0 z-5 grid grid-cols-[minmax(18rem,30vw)_1fr_minmax(16rem,24vw)] grid-rows-[clamp(4rem,9vh,6.5rem)_1fr] gap-[clamp(1rem,2vw,2rem)] px-[clamp(1.1rem,3vw,2.6rem)] pt-[clamp(1.1rem,3vw,2.6rem)] pb-[clamp(5.8rem,11vh,7.2rem)]',
  'tight:grid-cols-[minmax(16rem,32vw)_1fr_minmax(14rem,26vw)]',
  'desktop:grid-rows-[clamp(4rem,9vh,6.5rem)_minmax(0,1fr)]',
  'desktop-short:grid-rows-[clamp(3.6rem,8vh,5rem)_minmax(0,1fr)] desktop-short:pb-[clamp(4.6rem,10vh,5.6rem)]',
  'stacked:relative stacked:inset-auto stacked:flex stacked:h-auto stacked:flex-col stacked:items-stretch stacked:gap-[clamp(1.1rem,4vw,1.7rem)] stacked:overflow-visible stacked:px-[clamp(1.2rem,4.6vw,2.2rem)] stacked:pt-[clamp(1.1rem,3.4vw,1.6rem)] stacked:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]',
  'stacked-wide:gap-[clamp(0.8rem,1.6vh,1.3rem)]',
  'narrow:px-4 narrow:pt-4 narrow:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]',
  'phone:pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]',
)

// A rail never grows past the space between the header and the strip on
// desktop: content that still does not fit scrolls inside it (the padding and
// equal negative margin keep the glows inside the clip).
const RAIL = cx(
  'side-panels__rail pointer-events-auto row-start-2 grid gap-[clamp(0.9rem,1.4vw,1.4rem)] self-center text-ink-100/92',
  'desktop:-m-4 desktop:max-h-[calc(100%+2rem)] desktop:overflow-y-auto desktop:overscroll-contain desktop:p-4 desktop:[scrollbar-color:var(--accent-line)_transparent] desktop:[scrollbar-width:thin]',
  'desktop-short:gap-[clamp(0.6rem,1.3vh,0.9rem)]',
  'stacked:max-w-full stacked:self-stretch stacked:text-left',
  'stacked-wide:max-w-[min(45rem,100%)]',
)

// On desktop the call to action stays in view at the bottom of a rail that scrolls.
const CTA =
  'side-panels__cta mt-[0.3rem] desktop:sticky desktop:bottom-0 narrow:min-h-11 narrow:px-[0.85rem] narrow:py-[0.55rem] narrow:text-[0.62rem]'

// Rise order of each part on a face change (SidePanels.css).
const rise = (delay: number) => ({ 'data-rise': true, style: { '--rise-delay': `${delay}ms` } as CSSProperties })

export function SidePanels({ activeSection, onOpenDetail, transitionState = 'idle' }: SidePanelsProps) {
  // Each rail is a landmark named by its own heading, so screen readers can
  // tell them apart.
  const titleId = useId()
  const flowTitleId = useId()
  const titleLines = useMemo(() => splitTitleIntoTwoLines(activeSection.title), [activeSection.title])
  // Per-face accent from visual.json (ADR 003); accent-scope derives its tones.
  const accentStyle = { '--section-accent': activeSection.accent } as CSSProperties

  const renderCta = (cta: CubeSection['ctaPrimary'], className: string) => {
    if (!cta) return null
    if (cta.href) {
      return (
        <PillButton className={cx(CTA, className)} href={cta.href} {...rise(185)}>
          {cta.label}
        </PillButton>
      )
    }
    return (
      <PillButton className={cx(CTA, className)} onClick={(event) => onOpenDetail(undefined, event.currentTarget)} {...rise(185)}>
        {cta.label}
      </PillButton>
    )
  }

  return (
    <div className={PANELS} style={accentStyle} data-section={activeSection.id} data-transition={transitionState}>
      <aside className={cx(RAIL, 'col-start-1 max-w-[32rem] narrow:gap-[0.72rem]')} key={`L-${activeSection.id}`} aria-labelledby={titleId}>
        <Eyebrow className="narrow:text-[0.55rem] narrow:tracking-[0.26em]" {...rise(0)}>
          {activeSection.eyebrow}
        </Eyebrow>
        <h2
          className="m-0 grid text-face-title text-ink-50/98 text-shadow-title tight:text-[clamp(2.1rem,4vw,3.4rem)] desktop-short:text-[clamp(2rem,min(4.2vw,7vh),4.2rem)] stacked:text-[clamp(1.9rem,min(7.5vw,5vh),3rem)] narrow:text-[clamp(2rem,12vw,2.8rem)] narrow:leading-[0.92]"
          id={titleId}
          {...rise(55)}
        >
          {titleLines[1] ? (
            <>
              <span>{titleLines[0]}</span>
              <span className="text-accent-gradient">{titleLines[1]}</span>
            </>
          ) : (
            <span className="text-accent-gradient">{titleLines[0]}</span>
          )}
        </h2>
        <RichText
          as="p"
          className="m-0 max-w-[28rem] text-summary text-ink-200/78 stacked-wide:max-w-[38rem] narrow:max-w-[22rem] narrow:text-[0.8rem] narrow:leading-[1.42]"
          html={activeSection.summary}
          {...rise(105)}
        />

        {activeSection.features && activeSection.features.length > 0 && (
          activeSection.id === 'research' && activeSection.researchConcepts?.length ? (
            <div
              className="research-map relative grid max-w-[29rem] gap-[0.55rem] py-[0.12rem] pr-0 pl-4 stacked-wide:max-w-[min(46rem,100%)] stacked-wide:grid-cols-2 stacked-wide:pl-0 narrow:max-w-full narrow:grid-cols-2 narrow:gap-[0.45rem] narrow:p-0 phone-small:grid-cols-1 phone-small:gap-[0.4rem]"
              aria-label="Research concepts"
              {...rise(145)}
            >
              {activeSection.researchConcepts.slice(0, 4).map((concept) => (
                <button
                  className="research-node focus-ring relative m-0 grid min-h-[4.25rem] w-full cursor-pointer gap-[0.2rem] rounded-[7px] border border-violet-500/28 px-[0.82rem] py-[0.72rem] text-left font-[inherit] text-ink-100/90 transition-[border-color,background,transform] duration-180 hover:translate-x-[0.18rem] hover:border-violet-300/62 desktop-short:min-h-0 desktop-short:px-3 desktop-short:py-2 narrow:min-h-[3.2rem] narrow:px-[0.62rem] narrow:py-[0.55rem] phone-small:min-h-12 phone-small:px-[0.7rem] phone-small:py-2"
                  key={concept.key}
                  type="button"
                  onClick={(event) => onOpenDetail(createResearchConceptDetail(concept), event.currentTarget)}
                >
                  <span className="text-concept-axis text-violet-300/76 uppercase narrow:text-[0.48rem] narrow:tracking-[0.18em]">{concept.axis}</span>
                  <strong className="text-concept text-ink-50/96 uppercase narrow:text-[0.68rem] narrow:leading-[1.2] narrow:tracking-[0.06em] narrow:text-balance">
                    {concept.label}
                  </strong>
                  <RichText as="small" className="text-concept-summary text-ink-200/70 narrow:hidden" html={concept.summary} priority="secondary" />
                </button>
              ))}
            </div>
          ) : (
            <ul
              className="m-0 grid list-none gap-[clamp(0.6rem,1vw,0.9rem)] p-0 desktop-short:gap-[clamp(0.45rem,1.1vh,0.75rem)] stacked-wide:grid-cols-2 stacked-wide:gap-x-[1.2rem] stacked-wide:gap-y-[0.78rem]"
              {...rise(145)}
            >
              {activeSection.features.map((feature) => (
                <li
                  key={feature.label}
                  className="grid grid-cols-[2.6rem_minmax(0,1fr)] items-start gap-[0.9rem] desktop-short:grid-cols-[2.4rem_minmax(0,1fr)] desktop-short:items-center stacked-wide:grid-cols-[2.35rem_minmax(0,1fr)]"
                >
                  <GlyphTile className="desktop-short:size-[1.9rem]">
                    <FeatureGlyph glyph={feature.glyph} />
                  </GlyphTile>
                  <div className="grid min-w-0 gap-[0.2rem]">
                    <strong className="text-label text-(--accent) uppercase">{feature.label}</strong>
                    <RichText as="p" className="m-0 text-body-sm text-ink-200/74" html={feature.description} />
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {renderCta(activeSection.ctaPrimary, 'justify-self-start')}
      </aside>

      <aside
        className={cx(RAIL, 'col-start-3 max-w-[26rem] justify-self-end text-left narrow:gap-[0.58rem]')}
        key={`R-${activeSection.id}`}
        aria-labelledby={flowTitleId}
      >
        <header
          className="flex items-baseline justify-between gap-4 border-b border-(--accent-line) pb-[0.6rem] stacked-wide:max-w-[min(44rem,100%)] narrow:pb-[0.42rem]"
          {...rise(55)}
        >
          <span className="text-rail-title text-(--accent) uppercase" id={flowTitleId}>
            {activeSection.flowTitle ?? activeSection.label}
          </span>
          <strong aria-hidden className="text-counter text-[color-mix(in_srgb,var(--accent)_60%,transparent)] narrow:text-[1.35rem]">
            {String(activeSection.flow?.length ?? 0).padStart(2, '0')}
          </strong>
        </header>

        {activeSection.flow && activeSection.flow.length > 0 && (
          <ol
            className="m-0 grid list-none gap-[clamp(0.7rem,1vw,1.05rem)] p-0 desktop-short:gap-[clamp(0.45rem,1.1vh,0.75rem)] stacked-wide:max-w-[min(44rem,100%)] stacked-wide:grid-cols-2 narrow:grid-cols-2 narrow:gap-[0.45rem]"
            {...rise(105)}
          >
            {activeSection.flow.map((step, index) => (
              <li
                key={step.label}
                className="flow-step relative grid grid-cols-[2.4rem_minmax(0,1fr)] items-start gap-[0.9rem] desktop-short:grid-cols-[2rem_minmax(0,1fr)] desktop-short:items-center narrow:min-h-[2.2rem] narrow:grid-cols-[1.9rem_minmax(0,1fr)] narrow:gap-2"
              >
                <NumberBadge className="desktop-short:size-8 narrow:size-[1.9rem] narrow:text-[0.62rem]" value={index + 1} />
                <div>
                  <strong className="text-step text-ink-50/96 uppercase narrow:text-[0.62rem] narrow:tracking-[0.12em]">{step.label}</strong>
                  <RichText as="p" className="m-0 mt-[0.18rem] text-body-sm text-ink-200/74 narrow:hidden" html={step.description} />
                </div>
              </li>
            ))}
          </ol>
        )}

        {renderCta(activeSection.ctaSecondary, 'justify-self-end stacked:justify-self-start')}
      </aside>
    </div>
  )
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
