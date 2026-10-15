import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FaceId } from '@/kernel/faces'
import type { FaceDetail } from '@/kernel/siteContent'
import { resolveSections } from '@/kernel/visualContent'
import { interfaceCopy } from '@/features/content/copy'
import { useSiteContent } from '@/features/content/useSiteContent'
import { useVisualContent } from '@/features/content/useVisualContent'
import { openWorldShowcase } from '@/features/dev/openWorldShowcase'
import { createExperienceStore, ExperienceProvider, initialExperience, useExperience, useExperienceStore } from '@/features/experience/experienceStore'
import { readInitialFace, useFaceUrl } from '@/features/experience/faceUrl'
import { readIntroPlan } from '@/features/experience/introPlan'
import type { IntroPlan } from '@/features/experience/introPlan'
import { useFaceTransition } from '@/features/experience/useFaceTransition'
import { useIntroLifecycle } from '@/features/experience/useIntroLifecycle'
import { DetailDialog } from '@/features/faces/DetailDialog'
import { FaceRails } from '@/features/faces/FaceRails'
import { FaceStrip } from '@/features/navigation/FaceStrip'
import { RotateHint } from '@/features/navigation/RotateHint'
import { SceneLayer } from '@/features/scene/SceneLayer'
import { StageView } from '@/features/stage/StageView'
import { hasWebGL } from '@/lib/hasWebGL'
import { useViewportSize } from '@/lib/useViewportSize'
import { useLayoutMode } from '@/styles/layoutModes'
import { cx } from '@/ui/cx'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { IdentityChrome } from './IdentityChrome'
import './intro.css'
import './shell.css'

// The cursor follows what the pointer can do with the cube.
const CURSOR = { default: 'cursor-default', grab: 'cursor-grab', grabbing: 'cursor-grabbing' } as const

// Concept: `?layout=escenario` turns on the stage layout on desktop.
const STAGE_REQUESTED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('layout') === 'escenario'

const LOCALE_OPTIONS = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
] as const

// The home page: the cube with the rails around it. Creates the experience
// store once; the scene and the interface meet only through it (ADR 006).
export function Experience() {
  const [plan] = useState(readIntroPlan)
  const [webglAvailable] = useState(hasWebGL)
  const [store] = useState(() =>
    createExperienceStore(
      // Without WebGL there is no scene to land, so the interface shows at once.
      initialExperience({
        face: readInitialFace(),
        introPlays: plan.play && webglAvailable,
        hintVisible: plan.showHint && !STAGE_REQUESTED,
        layout: STAGE_REQUESTED ? 'stage' : 'rails',
      }),
    ),
  )

  return (
    <ExperienceProvider value={store}>
      <ExperienceView plan={plan} webglAvailable={webglAvailable} />
    </ExperienceProvider>
  )
}

function ExperienceView({ plan, webglAvailable }: { plan: IntroPlan; webglAvailable: boolean }) {
  const store = useExperienceStore()
  const activeFace = useExperience((state) => state.activeFace)
  const displayedFace = useExperience((state) => state.displayedFace)
  const transition = useExperience((state) => state.transition)
  const intro = useExperience((state) => state.intro)
  const hintVisible = useExperience((state) => state.hintVisible)
  const detail = useExperience((state) => state.detail)
  const cursor = useExperience((state) => state.cursor)
  const layout = useExperience((state) => state.layout)
  const explore = useExperience((state) => state.explore)
  const { content, locale, sections, setLocale } = useSiteContent()
  const visual = useVisualContent()
  const copy = interfaceCopy(locale)
  const viewport = useViewportSize()
  const { stacked } = useLayoutMode()
  // The control that opened the detail dialog; focus returns to it on close.
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const [isTouch] = useState(() => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false))

  // The stage concept is designed for desktop only; stacked screens keep the rails.
  useEffect(() => {
    if (STAGE_REQUESTED) store.dispatch({ type: 'layoutChanged', layout: stacked ? 'rails' : 'stage' })
  }, [stacked, store])
  const stage = layout === 'stage'

  useFaceTransition()
  useIntroLifecycle(plan)
  useFaceUrl(activeFace, locale)

  const resolvedSections = useMemo(() => resolveSections(sections, visual), [sections, visual])
  const activeSection = resolvedSections.find((section) => section.id === activeFace) ?? null
  const displayedSection = resolvedSections.find((section) => section.id === displayedFace) ?? activeSection

  // The dialog shows what opened it (a research concept), otherwise the face's
  // `detail`, otherwise its long-form fields.
  const dialogDetail = useMemo<FaceDetail | null>(() => {
    if (detail.focused) return detail.focused
    if (!activeSection) return null
    if (activeSection.detail) return activeSection.detail
    return {
      title: activeSection.title,
      summary: activeSection.intro ?? activeSection.summary,
      points: [...(activeSection.highlights ?? []), ...(activeSection.proofPoints ?? [])],
      links: activeSection.links,
    }
  }, [activeSection, detail.focused])

  const openDetail = useCallback(
    (focused?: FaceDetail, trigger?: HTMLElement) => {
      restoreFocusRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
      store.dispatch({ type: 'detailOpened', detail: focused ?? null })
    },
    [store],
  )
  const closeDetail = useCallback(() => store.dispatch({ type: 'detailClosed' }), [store])
  const requestFace = useCallback((face: FaceId) => store.dispatch({ type: 'faceRequested', face }), [store])

  // In the stacked layout the page scrolls and the cube hero takes its height
  // from CSS, so the shell and canvas stop being pinned to the viewport height.
  const pinned = { width: viewport.width || '100vw', height: stacked ? undefined : viewport.height || '100vh' }

  return (
    <main
      className={cx(
        'experience-shell relative block h-svh min-h-svh w-screen max-w-none overflow-hidden text-page-ink stacked:h-auto stacked:overflow-visible',
        CURSOR[cursor],
      )}
      aria-label={copy.experienceLabel}
      data-intro={intro !== 'done' ? intro : undefined}
      onDoubleClick={import.meta.env.DEV ? (event) => openWorldShowcase(event, activeFace) : undefined}
      style={pinned}
    >
      <div
        className="cube-canvas absolute inset-0 z-0 h-svh w-screen max-w-none transition-opacity delay-120 duration-520 motion-reduce:duration-1 stacked:relative stacked:inset-auto stacked:h-[52svh] stacked:min-h-72 stacked:w-full"
        aria-hidden="true"
        style={pinned}
      >
        <SceneLayer sections={resolvedSections} plan={plan} webglAvailable={webglAvailable} />
        {plan.showHint && webglAvailable && <RotateHint visible={hintVisible} label={isTouch ? copy.hintTouch : copy.hintPointer} />}
      </div>

      {stage && displayedSection && (
        <StageView
          identity={content.identity}
          locale={locale}
          localeOptions={LOCALE_OPTIONS}
          languageLabel={copy.languageLabel}
          onLocaleChange={setLocale}
          sections={resolvedSections}
          activeFace={activeFace}
          displayedSection={displayedSection}
          transition={transition}
          explore={explore}
          onRequestFace={requestFace}
          onExplore={(next) => store.dispatch({ type: next ? 'exploreStarted' : 'exploreEnded' })}
          onOpenDetail={(trigger) => openDetail(undefined, trigger)}
        />
      )}

      {!stage && <IdentityChrome identity={content.identity} />}

      {!stage && (
        <SegmentedControl
          className="language-toggle absolute top-corner right-corner z-10"
          label={copy.languageLabel}
          options={LOCALE_OPTIONS}
          value={locale}
          onChange={setLocale}
        />
      )}

      {!stage && displayedSection && (
        <FaceRails activeSection={displayedSection} copy={copy} onOpenDetail={openDetail} transitionState={transition} />
      )}

      {!stage && displayedSection && (
        <FaceStrip
          activeSectionId={activeFace}
          fullName={content.identity.fullName}
          label={copy.faceStripLabel}
          locale={locale}
          onSelectSection={requestFace}
          sections={sections}
        />
      )}

      {detail.open && dialogDetail && (
        <DetailDialog
          detail={dialogDetail}
          faceLabel={activeSection?.label ?? ''}
          closeLabel={copy.close}
          onClose={closeDetail}
          restoreFocusRef={restoreFocusRef}
        />
      )}
    </main>
  )
}
