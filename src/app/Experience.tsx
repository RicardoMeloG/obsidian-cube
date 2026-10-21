import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FaceId } from '@/kernel/faces'
import type { FaceDetail } from '@/kernel/siteContent'
import { resolveSections } from '@/kernel/visualContent'
import { interfaceCopy } from '@/features/content/copy'
import { useSiteContent } from '@/features/content/useSiteContent'
import { useVisualContent } from '@/features/content/useVisualContent'
import { openWorldShowcase } from '@/features/dev/openWorldShowcase'
import { createExperienceStore, ExperienceProvider, initialExperience, useExperience, useExperienceStore } from '@/features/experience/experienceStore'
import { readInitialFace, urlNamesFace, useFaceUrl } from '@/features/experience/faceUrl'
import { readIntroPlan } from '@/features/experience/introPlan'
import type { IntroPlan } from '@/features/experience/introPlan'
import { useFaceTransition } from '@/features/experience/useFaceTransition'
import { useCubeNudge } from '@/features/experience/useCubeNudge'
import { useIntroLifecycle } from '@/features/experience/useIntroLifecycle'
import { DetailDialog } from '@/features/faces/DetailDialog'
import { CubeNudge } from '@/features/navigation/CubeNudge'
import { RotateHint } from '@/features/navigation/RotateHint'
import { SceneLayer } from '@/features/scene/SceneLayer'
import { StageView } from '@/features/stage/StageView'
import { hasWebGL } from '@/lib/hasWebGL'
import { useViewportSize } from '@/lib/useViewportSize'
import { LAYOUT_QUERIES, useLayoutMode } from '@/styles/layoutModes'
import { cx } from '@/ui/cx'
import './intro.css'
import './shell.css'

// The cursor follows what the pointer can do with the cube.
const CURSOR = { default: 'cursor-default', grab: 'cursor-grab', grabbing: 'cursor-grabbing' } as const

// Desktop shows the stage, stacked screens the hero (spec 011, E-1).
const startsStacked = () => typeof window !== 'undefined' && window.matchMedia(LAYOUT_QUERIES.stacked).matches

const LOCALE_OPTIONS = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
] as const

// The home page: the cube with the face's composition around it. Creates the experience
// store once; the scene and the interface meet only through it (ADR 006).
export function Experience() {
  const [plan] = useState(readIntroPlan)
  const [webglAvailable] = useState(hasWebGL)
  const [store] = useState(() => {
    const hero = startsStacked()
    return createExperienceStore(
      // Without WebGL there is no scene to land, so the interface shows at once.
      // The rotate hint belongs to the hero, where the cube is dragged directly.
      initialExperience({
        face: readInitialFace(),
        introPlays: plan.play && webglAvailable,
        hintVisible: plan.showHint && hero,
        layout: hero ? 'hero' : 'stage',
        nudge: plan.showNudge,
        // The desktop opens in cube mode until the visitor picks a face
        // (owner, 2026-10-20); a link to a face opens on its content, and
        // without WebGL there is no cube to pick from.
        explore: webglAvailable && !urlNamesFace(),
      }),
    )
  })

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
  const explore = useExperience((state) => state.explore)
  const nudge = useExperience((state) => state.nudge)
  const { content, locale, sections, setLocale } = useSiteContent()
  const visual = useVisualContent()
  const copy = interfaceCopy(locale)
  const viewport = useViewportSize()
  const { stacked } = useLayoutMode()
  // The control that opened the detail dialog; focus returns to it on close.
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const [isTouch] = useState(() => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false))

  useEffect(() => {
    store.dispatch({ type: 'layoutChanged', layout: stacked ? 'hero' : 'stage' })
  }, [stacked, store])

  useFaceTransition()
  useIntroLifecycle(plan)
  useCubeNudge()
  useFaceUrl(activeFace, locale)

  const resolvedSections = useMemo(() => resolveSections(sections, visual), [sections, visual])
  const activeSection = resolvedSections.find((section) => section.id === activeFace) ?? null
  const displayedSection = resolvedSections.find((section) => section.id === displayedFace) ?? activeSection

  // The dialog shows the face's `detail`, otherwise its long-form fields.
  const dialogDetail = useMemo<FaceDetail | null>(() => {
    if (!activeSection) return null
    if (activeSection.detail) return activeSection.detail
    return {
      title: activeSection.title,
      summary: activeSection.intro ?? activeSection.summary,
      points: [...(activeSection.highlights ?? []), ...(activeSection.proofPoints ?? [])],
      links: activeSection.links,
    }
  }, [activeSection])

  const openDetail = useCallback(
    (trigger?: HTMLElement) => {
      restoreFocusRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
      store.dispatch({ type: 'detailOpened' })
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
        {plan.showNudge && webglAvailable && !stacked && <CubeNudge visible={nudge === 'shown'} explore={explore} label={copy.nudge} />}
      </div>

      {displayedSection && (
        <StageView
          identity={content.identity}
          copy={copy}
          locale={locale}
          localeOptions={LOCALE_OPTIONS}
          onLocaleChange={setLocale}
          sections={resolvedSections}
          activeFace={activeFace}
          displayedSection={displayedSection}
          transition={transition}
          explore={explore}
          onRequestFace={requestFace}
          onExplore={(next) => store.dispatch({ type: next ? 'exploreStarted' : 'exploreEnded' })}
          onOpenDetail={openDetail}
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
