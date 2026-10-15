import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { Rotate3d, X } from 'lucide-react'
import type { FaceId } from '@/kernel/faces'
import { FACE_ORDER } from '@/kernel/faces'
import type { SiteContent, SiteLocale } from '@/kernel/siteContent'
import type { ResolvedFace } from '@/kernel/visualContent'
import type { PanelTransition } from '@/features/experience/experienceStore'
import { cx } from '@/ui/cx'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { stageCopy } from './conceptContent'
import { StageFaceView } from './StageFaces'
import { GithubMark, LinkedinMark, StageIcon } from './StageIcon'
import './stage.css'

type StageViewProps = {
  identity: SiteContent['identity']
  locale: SiteLocale
  localeOptions: readonly { value: SiteLocale; label: string }[]
  languageLabel: string
  onLocaleChange: (locale: SiteLocale) => void
  sections: ResolvedFace[]
  activeFace: FaceId
  displayedSection: ResolvedFace
  transition: PanelTransition
  explore: boolean
  onRequestFace: (face: FaceId) => void
  onExplore: (explore: boolean) => void
  onOpenDetail: (trigger?: HTMLElement) => void
}

// The stage concept: identity and contact links on top, the face's own
// composition in the middle, a dock of faces at the bottom. The cube waits
// small behind it all (the scene reads the same store) and comes forward to
// change face or when the visitor takes it.
export function StageView({
  identity,
  locale,
  localeOptions,
  languageLabel,
  onLocaleChange,
  sections,
  activeFace,
  displayedSection,
  transition,
  explore,
  onRequestFace,
  onExplore,
  onOpenDetail,
}: StageViewProps) {
  const copy = stageCopy(locale)
  const face = copy.faces[displayedSection.id]
  const accentStyle = { '--section-accent': displayedSection.accent } as CSSProperties
  const index = FACE_ORDER.indexOf(displayedSection.id) + 1

  useEffect(() => {
    if (!explore) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExplore(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [explore, onExplore])

  return (
    <div className="stage accent-scope" style={accentStyle} data-face={displayedSection.id} data-transition={transition} data-explore={explore || undefined}>
      <header className="stage-top">
        <div className="stage-identity">
          <h1>{identity.displayName}</h1>
          <p className="stage-identity__role">{identity.role}</p>
          {identity.keywords && <p className="stage-identity__keywords">{identity.keywords}</p>}
        </div>

        <button className="stage-explore focus-ring" type="button" aria-pressed={explore} onClick={() => onExplore(!explore)}>
          {explore ? <X aria-hidden size={15} strokeWidth={1.8} /> : <Rotate3d aria-hidden size={15} strokeWidth={1.6} />}
          <span>{explore ? copy.exploreBack : copy.explore}</span>
        </button>

        <div className="stage-actions">
          <button className="stage-link focus-ring" type="button" onClick={() => onRequestFace('contact')}>
            <StageIcon id="mail" size={16} />
            <span>{copy.links.email}</span>
          </button>
          <a className="stage-link focus-ring" href={`https://github.com/${identity.handle}`} target="_blank" rel="noreferrer">
            <GithubMark />
            <span>{copy.links.github}</span>
          </a>
          <a className="stage-link focus-ring" href="#linkedin" onClick={(event) => event.preventDefault()}>
            <LinkedinMark />
            <span>{copy.links.linkedin}</span>
          </a>
          <SegmentedControl className="stage-locale" label={languageLabel} options={localeOptions} value={locale} onChange={onLocaleChange} />
        </div>
      </header>

      <section className="stage-content" key={displayedSection.id} aria-label={displayedSection.label}>
        <StageFaceView face={face} counter={copy.counter(index, FACE_ORDER.length)} identity={identity} onOpenDetail={onOpenDetail} />
      </section>

      <p className="stage-hint" aria-live="polite">
        {explore ? copy.exploreHint : ''}
      </p>

      <nav className="stage-dock" aria-label="Caras">
        <ul>
          {sections.map((section) => {
            const active = section.id === activeFace
            const dock = copy.dock[section.id]
            return (
              <li key={section.id} style={{ '--section-accent': section.accent } as CSSProperties} className="accent-scope">
                <a
                  className={cx('stage-dock__item focus-ring', active && 'is-active')}
                  aria-current={active ? 'page' : undefined}
                  href={`?section=${section.id}&lang=${locale}&layout=escenario`}
                  onClick={(event) => {
                    event.preventDefault()
                    onRequestFace(section.id)
                  }}
                >
                  <span className="stage-dock__icon">
                    <StageIcon id={dock.icon} size={17} />
                  </span>
                  <span className="stage-dock__text">
                    <strong>{section.label}</strong>
                    <small>{dock.subtitle}</small>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
