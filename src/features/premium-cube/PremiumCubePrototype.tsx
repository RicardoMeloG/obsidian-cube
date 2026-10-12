import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { CUBE_FACE_ORDER } from '../../kernel/faces'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { hasWebGL } from '../../lib/hasWebGL'
import { useLayoutMode } from '../../styles/layoutModes'
import type { CubeSectionDetail, CubeSectionId } from '../../kernel/faces'
import { CubeSectionNav } from './CubeSectionNav'
import { useSiteContent } from '../content/useSiteContent'
import { useVisualContent } from '../content/useVisualContent'
import { resolveSections } from '../../kernel/visualContent'
import { RichText } from '../content/RichText'
import { readDiagnosticFx } from './diagnosticFx'
import { CubeScene } from './scene/CubeScene'
import type { CubeIntroConfig, CubeSceneHandle } from './scene/CubeScene'
import { CUBE_ENGAGED_KEY, INTRO_SEEN_KEY, RETURN_TURN, planIntro, readFreezeAt } from './scene/intro/introTimeline'
import type { IntroPhase } from './scene/intro/introTimeline'
import { SidePanels } from './SidePanels'

type PanelTransitionState = 'idle' | 'exiting' | 'entering'

// pending: interface hidden while the cube falls · reveal: staged fade-in after
// the landing · done: no intro styling at all.
type IntroStage = 'pending' | 'reveal' | 'done'

// If the scene never renders (no WebGL, slow load) the interface still appears.
const INTRO_SAFETY_MS = 4000
// Long enough for the last staged element (the hint: 1100ms delay + 600ms fade).
const REVEAL_MS = 2000

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function remember(key: string) {
  try {
    sessionStore()?.setItem(key, '1')
  } catch {
    // Storage blocked: the intro may replay, which is harmless.
  }
}

function readIntroPlan() {
  if (typeof window === 'undefined') {
    return { play: false, reducedMotion: false, showHint: false }
  }
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  return planIntro(window.location.search, sessionStore(), reducedMotion)
}

const HINT_COPY = {
  en: { pointer: 'Drag to rotate', touch: 'Swipe to rotate' },
  es: { pointer: 'Arrastra para girar', touch: 'Desliza para girar' },
} as const

function readInitialSectionId(): CubeSectionId {
  if (typeof window === 'undefined') {
    return 'agentic'
  }

  const requestedSection = new URLSearchParams(window.location.search).get('section')
  return CUBE_FACE_ORDER.includes(requestedSection as CubeSectionId) ? (requestedSection as CubeSectionId) : 'agentic'
}

export function PremiumCubePrototype() {
  const [cursorMode, setCursorMode] = useState<'default' | 'grab' | 'grabbing'>('default')
  const [activeSectionId, setActiveSectionId] = useState<CubeSectionId>(() => readInitialSectionId())
  const [displayedSectionId, setDisplayedSectionId] = useState<CubeSectionId>(() => readInitialSectionId())
  const [panelTransitionState, setPanelTransitionState] = useState<PanelTransitionState>('idle')
  const [detailOpen, setDetailOpen] = useState(false)
  const [focusedDetail, setFocusedDetail] = useState<CubeSectionDetail | null>(null)
  const cubeSceneRef = useRef<CubeSceneHandle | null>(null)
  const displayedSectionIdRef = useRef(displayedSectionId)
  const shellRef = useRef<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const dialogPanelRef = useRef<HTMLElement | null>(null)
  const dialogTitleRef = useRef<HTMLHeadingElement | null>(null)
  // The control that opened the detail dialog; focus returns to it on close.
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const { content, locale, sections, setLocale } = useSiteContent()
  const visual = useVisualContent()
  const [introPlan] = useState(readIntroPlan)
  const [webglAvailable] = useState(hasWebGL)
  // Without WebGL there is no scene to land, so the interface shows at once.
  const [introStage, setIntroStage] = useState<IntroStage>(introPlan.play && webglAvailable ? 'pending' : 'done')
  const [hintVisible, setHintVisible] = useState(introPlan.showHint)
  const [isTouch] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false),
  )
  const introConfig = useMemo<CubeIntroConfig>(
    () => ({
      play: introPlan.play,
      turns: !introPlan.play && introPlan.showHint && !introPlan.reducedMotion ? [RETURN_TURN] : [],
      freezeAt: import.meta.env.DEV && typeof window !== 'undefined' ? readFreezeAt(window.location.search) : null,
    }),
    [introPlan],
  )
  // The landing starts the staged reveal; the reveal then runs on its own clock
  // (see REVEAL_MS), so a slow device that jumps frames still gets the order.
  const handleIntroPhase = useCallback((phase: IntroPhase) => {
    if (phase === 'landed' || phase === 'done') {
      setIntroStage((stage) => (stage === 'pending' ? 'reveal' : stage))
    }
  }, [])
  const handleEngaged = useCallback(() => {
    setHintVisible(false)
    remember(CUBE_ENGAGED_KEY)
  }, [])
  const resolvedSections = useMemo(() => resolveSections(sections, visual), [sections, visual])
  const syncSectionUrl = useCallback((id: CubeSectionId) => {
    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)
    url.searchParams.set('section', id)
    url.searchParams.set('lang', locale)
    window.history.replaceState({}, '', url)
  }, [locale])
  const requestFaceChange = useCallback((id: CubeSectionId) => {
    if (id === activeSectionId) return
    setFocusedDetail(null)
    setDetailOpen(false)
    syncSectionUrl(id)
    // The scene turns the cube and reports the face once it lands. Without a
    // scene (no WebGL, or it failed and the still image replaced it) the face
    // changes at once, so navigation never depends on the 3D.
    if (cubeSceneRef.current) {
      cubeSceneRef.current.enterSection(id)
    } else {
      setActiveSectionId(id)
    }
  }, [activeSectionId, syncSectionUrl])
  const [effects] = useState(() => readDiagnosticFx())
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }))
  const activeSection = useMemo(
    () => resolvedSections.find((section) => section.id === activeSectionId) ?? null,
    [activeSectionId, resolvedSections],
  )
  const displayedSection = useMemo(
    () => resolvedSections.find((section) => section.id === displayedSectionId) ?? activeSection,
    [activeSection, displayedSectionId, resolvedSections],
  )
  // The modal shows the face's `detail`; faces without one fall back to the
  // long-form fields (intro / highlights / proofPoints / links).
  const activeDetail = useMemo(() => {
    if (focusedDetail) return focusedDetail
    if (!activeSection) return null

    if (activeSection.detail) {
      return activeSection.detail
    }

    return {
      title: activeSection.title,
      summary: activeSection.intro ?? activeSection.summary,
      points: [...(activeSection.highlights ?? []), ...(activeSection.proofPoints ?? [])],
      links: activeSection.links,
    }
  }, [activeSection, focusedDetail])

  useEffect(() => {
    function syncViewport() {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)
    window.addEventListener('orientationchange', syncViewport)

    return () => {
      window.removeEventListener('resize', syncViewport)
      window.removeEventListener('orientationchange', syncViewport)
    }
  }, [])

  useEffect(() => {
    displayedSectionIdRef.current = displayedSectionId
  }, [displayedSectionId])

  // Intro bookkeeping: mark it seen for this session and never leave the
  // interface hidden if the scene does not report its landing.
  useEffect(() => {
    if (!introPlan.play) return
    remember(INTRO_SEEN_KEY)
    const safety = window.setTimeout(() => {
      setIntroStage((stage) => (stage === 'pending' ? 'reveal' : stage))
    }, INTRO_SAFETY_MS)
    return () => window.clearTimeout(safety)
  }, [introPlan.play])

  useEffect(() => {
    if (introStage !== 'reveal') return
    const settle = window.setTimeout(() => setIntroStage('done'), REVEAL_MS)
    return () => window.clearTimeout(settle)
  }, [introStage])

  // Any input while the intro runs skips it to the final state.
  const introRunning = introStage !== 'done'
  useEffect(() => {
    if (!introRunning) return

    function skip() {
      cubeSceneRef.current?.skipIntro()
      setIntroStage('done')
    }

    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    window.addEventListener('wheel', skip, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('wheel', skip)
    }
  }, [introRunning])

  useEffect(() => {
    if (activeSectionId === displayedSectionIdRef.current) return

    setPanelTransitionState('exiting')
    const swapTimer = window.setTimeout(() => {
      setDisplayedSectionId(activeSectionId)
      setPanelTransitionState('entering')
    }, 150)
    const settleTimer = window.setTimeout(() => {
      setPanelTransitionState('idle')
    }, 430)

    return () => {
      window.clearTimeout(swapTimer)
      window.clearTimeout(settleTimer)
    }
  }, [activeSectionId])

  // Dialog behaviour while open: everything behind it is `inert` (no focus, no
  // assistive-tech reading, no pointer), the document scroll is locked, focus
  // lands on the title, Tab cycles inside the panel, Escape closes. On close by
  // any path (Escape, scrim, close button) the background is restored and focus
  // returns to the control that opened the dialog.
  useEffect(() => {
    if (!detailOpen) {
      return
    }

    const dialog = dialogRef.current
    const panel = dialogPanelRef.current
    const shell = shellRef.current
    const inerted: Element[] = []
    if (shell && dialog) {
      for (const child of Array.from(shell.children)) {
        if (child !== dialog && !child.hasAttribute('inert')) {
          child.setAttribute('inert', '')
          inerted.push(child)
        }
      }
    }
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'

    dialogTitleRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setDetailOpen(false)
        return
      }
      if (event.key !== 'Tab' || !panel) {
        return
      }
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'),
      ).filter((element) => !element.hasAttribute('disabled'))
      if (focusables.length === 0) {
        event.preventDefault()
        dialogTitleRef.current?.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      // Focus on the title, on the scrim, on <body> or anywhere outside the
      // panel counts as a boundary in both directions.
      const outside = !(active instanceof Element) || !panel.contains(active) || active === dialogTitleRef.current
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      root.style.overflow = previousOverflow
      inerted.forEach((element) => element.removeAttribute('inert'))
      const restore = restoreFocusRef.current
      restoreFocusRef.current = null
      if (restore && restore.isConnected) {
        restore.focus()
      }
    }
  }, [detailOpen])

  // Dev only: double-click on the background (not on the panels / nav / toggles)
  // opens the standalone world showcase for the active face (?bg=<world>). The
  // visitor-facing "fullscreen art mode" from ADR 001 is still pending.
  const handleBackgroundDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement
      if (
        target.closest(
          '.side-panels__rail, .cube-section-nav, .language-toggle, .prototype-chrome, .detail-modal, button, a',
        )
      ) {
        return
      }
      const params = new URLSearchParams(window.location.search)
      params.set('bg', activeSectionId)
      window.location.search = `?${params.toString()}`
    },
    [activeSectionId],
  )

  // In the stacked layout the page scrolls and the cube hero takes its height
  // from CSS, so the shell and canvas stop being pinned to the viewport height.
  const { stacked: isMobileViewport } = useLayoutMode()
  const scenePoster = <img className="cube-canvas__poster" src="/og-image.jpg" alt="" />

  return (
    <main
      className={`prototype-shell is-${cursorMode}`}
      aria-label="Premium cube prototype"
      data-intro={introRunning ? introStage : undefined}
      ref={shellRef}
      onDoubleClick={import.meta.env.DEV ? handleBackgroundDoubleClick : undefined}
      style={{ width: viewport.width || '100vw', height: isMobileViewport ? undefined : viewport.height || '100vh' }}
    >
      <div
        className="cube-canvas"
        aria-hidden="true"
        style={{ width: viewport.width || '100vw', height: isMobileViewport ? undefined : viewport.height || '100vh' }}
      >
        {/* Without WebGL, or if the scene fails, a still of the cube replaces
            the canvas; the name, rails and strip are DOM and stay (ADR 006). */}
        {!webglAvailable ? (
          scenePoster
        ) : (
          <ErrorBoundary label="3D scene" fallback={scenePoster} onError={() => setIntroStage('done')}>
            <Canvas
              camera={{ position: [0, 1.05, 6.8], fov: 42, near: 0.1, far: 80 }}
              dpr={[1.5, 2]}
              gl={{
                antialias: true,
                alpha: false,
                powerPreference: 'high-performance',
                stencil: true,
              }}
              shadows={effects.shadows}
            >
              <Suspense fallback={null}>
                <CubeScene
                  activeSectionId={activeSectionId}
                  effects={effects}
                  onCursorModeChange={setCursorMode}
                  onSectionEnter={(sectionId) => {
                    setFocusedDetail(null)
                    setDetailOpen(false)
                    syncSectionUrl(sectionId)
                    setActiveSectionId(sectionId)
                  }}
                  sections={resolvedSections}
                  handleRef={cubeSceneRef}
                  intro={introConfig}
                  onIntroPhase={handleIntroPhase}
                  onEngaged={handleEngaged}
                />
              </Suspense>
            </Canvas>
          </ErrorBoundary>
        )}
        {introPlan.showHint && webglAvailable && (
          <p className="cube-hint" data-visible={hintVisible}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 13.5a8 4.5 0 0 0 15 0" />
              <path d="M16.6 16.4l2.9-2.9 0.6 4" />
            </svg>
            <span>{HINT_COPY[locale][isTouch ? 'touch' : 'pointer']}</span>
          </p>
        )}
      </div>

      <div className="prototype-chrome">
        <header className="prototype-kicker">
          <h1 className="prototype-kicker__name">{content.identity.displayName}</h1>
          <p className="prototype-kicker__role">{content.identity.role}</p>
          {content.identity.keywords && <p className="prototype-kicker__keywords">{content.identity.keywords}</p>}
        </header>
        <div className="prototype-mark">{content.identity.handle}</div>
        <div className="prototype-status">{content.identity.fullName}</div>
      </div>

      <div className="language-toggle" aria-label="Language">
        <button
          aria-pressed={locale === 'en'}
          className={locale === 'en' ? 'is-active' : ''}
          type="button"
          onClick={() => setLocale('en')}
        >
          EN
        </button>
        <button
          aria-pressed={locale === 'es'}
          className={locale === 'es' ? 'is-active' : ''}
          type="button"
          onClick={() => setLocale('es')}
        >
          ES
        </button>
      </div>

      {displayedSection && (
        <SidePanels
          activeSection={displayedSection}
          onOpenDetail={(detail, trigger) => {
            restoreFocusRef.current =
              trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
            setFocusedDetail(detail ?? null)
            setDetailOpen(true)
          }}
          transitionState={panelTransitionState}
        />
      )}

      {displayedSection && (
        <CubeSectionNav
          activeSectionId={activeSectionId}
          fullName={content.identity.fullName}
          locale={locale}
          onSelectSection={requestFaceChange}
          sections={sections}
        />
      )}

      {detailOpen && activeDetail && (
        <div className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-modal-title" ref={dialogRef}>
          {/* Pointer-only backdrop: not focusable, not announced. Keyboard and
              assistive tech close through the labelled button or Escape. */}
          <div className="detail-modal__scrim" aria-hidden="true" onClick={() => setDetailOpen(false)} />
          <article className="detail-modal__panel" ref={dialogPanelRef}>
            <button
              className="detail-modal__close"
              type="button"
              aria-label={locale === 'es' ? 'Cerrar' : 'Close'}
              onClick={() => setDetailOpen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className="detail-modal__body">
              <p className="detail-modal__eyebrow">{activeSection?.label}</p>
              <h2 id="detail-modal-title" ref={dialogTitleRef} tabIndex={-1}>
                {activeDetail.title}
              </h2>
              <RichText as="p" className="detail-modal__summary" html={activeDetail.summary} />
              {activeDetail.points && activeDetail.points.length > 0 && (
                <ul className="detail-modal__points">
                  {activeDetail.points.map((point) => (
                    <RichText as="li" key={point} html={point} />
                  ))}
                </ul>
              )}
              {activeDetail.links && activeDetail.links.length > 0 && (
                <div className="detail-modal__links">
                  {activeDetail.links.map((link) =>
                    link.href ? (
                      <a href={link.href} key={link.label} rel="noreferrer" target="_blank">
                        <strong>{link.label}</strong>
                        {link.description && <RichText as="span" html={link.description} />}
                      </a>
                    ) : (
                      <span key={link.label}>
                        <strong>{link.label}</strong>
                        {link.description && <RichText as="small" html={link.description} />}
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
          </article>
        </div>
      )}
    </main>
  )
}
