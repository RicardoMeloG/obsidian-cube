import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { FaceId } from '@/kernel/faces'
import { FACE_ORDER } from '@/kernel/faces'
import type { SiteContent, SiteLocale } from '@/kernel/siteContent'
import type { ResolvedFace } from '@/kernel/visualContent'
import type { InterfaceCopy } from '@/features/content/copy'
import type { PanelTransition } from '@/features/experience/experienceStore'
// The shared stage styles load before the templates', which refine them.
import './stage.css'
import { ordinal } from './motion'
import { StageComposition } from './StageComposition'
import { StageDock } from './StageDock'
import { StageTop } from './StageTop'

type StageViewProps = {
  identity: SiteContent['identity']
  copy: InterfaceCopy
  locale: SiteLocale
  localeOptions: readonly { value: SiteLocale; label: string }[]
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

// The stage (spec 011): identity and contact on top, the face's composition
// in the middle, the dock of faces at the bottom. The cube waits behind it all
// (the scene reads the same store) and comes forward to change face or when
// the visitor takes it. Everything shown is content; nothing is written here.
export function StageView({
  identity,
  copy,
  locale,
  localeOptions,
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
  const accentStyle = { '--section-accent': displayedSection.accent } as CSSProperties
  const counter = `${ordinal(FACE_ORDER.indexOf(displayedSection.id))} / ${ordinal(FACE_ORDER.length - 1)}`

  useEffect(() => {
    if (!explore) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExplore(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [explore, onExplore])

  return (
    <div
      className="stage accent-scope"
      style={accentStyle}
      data-face={displayedSection.id}
      data-template={displayedSection.composition.template}
      data-transition={transition}
      data-explore={explore || undefined}
    >
      <StageTop
        identity={identity}
        copy={copy}
        locale={locale}
        localeOptions={localeOptions}
        onLocaleChange={onLocaleChange}
        explore={explore}
        onExplore={onExplore}
        onContact={() => onRequestFace('contact')}
      />

      <section className="stage-content" key={displayedSection.id} aria-label={displayedSection.label}>
        <StageComposition face={displayedSection} counter={counter} onOpenDetail={onOpenDetail} />
      </section>

      <p className="stage-hint" aria-live="polite">
        {explore ? copy.exploreHint : ''}
      </p>

      <StageDock sections={sections} activeFace={activeFace} locale={locale} label={copy.faceStripLabel} onRequestFace={onRequestFace} />
    </div>
  )
}
