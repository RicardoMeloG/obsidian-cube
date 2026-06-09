import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { CUBE_FACE_ORDER } from './cubeSections'
import type { CubeSection, CubeSectionDetail, CubeSectionId } from './cubeSections'
import { CubeSectionNav } from './CubeSectionNav'
import { useSiteContent } from './content/useSiteContent'
import { readDiagnosticFx } from './diagnosticFx'
import { CubeScene } from './scene/CubeScene'
import type { CubeSceneHandle } from './scene/CubeScene'
import { SidePanels } from './SidePanels'

const ENABLE_FULLSCREEN_SECTION = false
type PanelTransitionState = 'idle' | 'exiting' | 'entering'

function SectionGlyph({ className = 'section-panel__glyph', sectionId }: { className?: string; sectionId: CubeSectionId }) {
  const accentBySection: Record<CubeSectionId, string> = {
    agentic: '#9fa5e1',
    products: '#9fa5e1',
    systems: '#b8c7ff',
    security: '#8ea7ff',
    research: '#b9a7ff',
    contact: '#d2d8ff',
  }
  const accent = accentBySection[sectionId]

  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 160 160">
      <defs>
        <radialGradient cx="50%" cy="50%" id={`glyph-glow-${sectionId}`} r="62%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
          <stop offset="46%" stopColor={accent} stopOpacity="0.12" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" fill={`url(#glyph-glow-${sectionId})`} r="76" />
      <path d="M80 18 142 80 80 142 18 80Z" fill="none" stroke={accent} strokeOpacity="0.52" />
      <path d="M80 38 122 80 80 122 38 80Z" fill="none" stroke="rgba(240,248,255,0.5)" />
      {sectionId === 'agentic' && (
        <>
          <path d="M48 80h64M80 48v64" stroke={accent} strokeLinecap="round" strokeOpacity="0.82" />
          <circle cx="80" cy="80" fill={accent} r="4" />
        </>
      )}
      {sectionId === 'products' && (
        <>
          <path d="M54 58h52v44H54Z" fill="none" stroke={accent} strokeOpacity="0.82" />
          <path d="M64 72h32M64 86h22" stroke={accent} strokeLinecap="round" strokeOpacity="0.72" />
        </>
      )}
      {sectionId === 'systems' && (
        <>
          <circle cx="55" cy="62" fill="none" r="12" stroke={accent} strokeOpacity="0.82" />
          <circle cx="105" cy="98" fill="none" r="12" stroke={accent} strokeOpacity="0.82" />
          <path d="M65 69 95 91M80 50v60" stroke={accent} strokeLinecap="round" strokeOpacity="0.72" />
        </>
      )}
      {sectionId === 'security' && (
        <>
          <path d="M80 48 108 60v22c0 22-13 35-28 43-15-8-28-21-28-43V60Z" fill="none" stroke={accent} />
          <path d="M68 80l8 8 18-20" stroke={accent} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {sectionId === 'research' && (
        <>
          <path d="M52 96c18-42 38-42 56 0M54 66c17 14 35 14 52 0" fill="none" stroke={accent} />
          <circle cx="80" cy="80" fill="none" r="7" stroke={accent} />
        </>
      )}
      {sectionId === 'contact' && (
        <>
          <path d="M50 64h60v42H50Z" fill="none" stroke={accent} />
          <path d="m52 66 28 24 28-24" fill="none" stroke={accent} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

type FaceArtifactProps = {
  copy: {
    artifacts: Record<CubeSectionId, string>
    capabilities: string[]
    contactState: string
    researchNodes: string[]
    securityControls: string[]
    systemNodes: string[]
  }
  section: CubeSection
}

function FaceArtifact({ copy, section }: FaceArtifactProps) {
  if (section.id === 'agentic') {
    return (
      <div className="obsidian-card face-artifact face-artifact--agentic" aria-label={copy.artifacts.agentic}>
        <span className="obsidian-card__shine" aria-hidden="true" />
        <div className="face-artifact__header">
          <span>{copy.artifacts.agentic}</span>
          <strong>04</strong>
        </div>
        <div className="agentic-flow">
          {copy.capabilities.map((capability, index) => (
            <div className="agentic-flow__node" key={capability}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{capability}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (section.id === 'products') {
    return (
      <div className="obsidian-card face-artifact face-artifact--products" aria-label={copy.artifacts.products}>
        <span className="obsidian-card__shine" aria-hidden="true" />
        <div className="face-artifact__header">
          <span>{copy.artifacts.products}</span>
          <strong>{String(section.links?.length ?? 0).padStart(2, '0')}</strong>
        </div>
        <div className="product-preview-grid">
          {(section.links ?? []).slice(0, 3).map((link, index) => (
            <article className="obsidian-card product-preview" key={link.label}>
              <span className="obsidian-card__shine" aria-hidden="true" />
              <small>{String(index + 1).padStart(2, '0')}</small>
              <h3>{link.label}</h3>
              {link.description && <p>{link.description}</p>}
            </article>
          ))}
        </div>
      </div>
    )
  }

  if (section.id === 'systems') {
    return (
      <div className="obsidian-card face-artifact face-artifact--systems" aria-label={copy.artifacts.systems}>
        <span className="obsidian-card__shine" aria-hidden="true" />
        <div className="face-artifact__header">
          <span>{copy.artifacts.systems}</span>
          <strong>OPS</strong>
        </div>
        <div className="systems-map">
          {copy.systemNodes.map((node, index) => (
            <span className={`systems-map__node systems-map__node--${index + 1}`} key={node}>
              {node}
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (section.id === 'security') {
    return (
      <div className="obsidian-card face-artifact face-artifact--security" aria-label={copy.artifacts.security}>
        <span className="obsidian-card__shine" aria-hidden="true" />
        <div className="face-artifact__header">
          <span>{copy.artifacts.security}</span>
          <strong>SAFE</strong>
        </div>
        <div className="security-grid">
          {copy.securityControls.map((control) => (
            <span key={control}>{control}</span>
          ))}
        </div>
      </div>
    )
  }

  if (section.id === 'research') {
    return (
      <div className="obsidian-card face-artifact face-artifact--research" aria-label={copy.artifacts.research}>
        <span className="obsidian-card__shine" aria-hidden="true" />
        <div className="face-artifact__header">
          <span>{copy.artifacts.research}</span>
          <strong>R&D</strong>
        </div>
        <div className="research-orbit">
          {copy.researchNodes.map((node, index) => (
            <span className={`research-orbit__node research-orbit__node--${index + 1}`} key={node}>
              {node}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="obsidian-card face-artifact face-artifact--contact" aria-label={copy.artifacts.contact}>
      <span className="obsidian-card__shine" aria-hidden="true" />
      <div className="face-artifact__header">
        <span>{copy.artifacts.contact}</span>
        <strong>OPEN</strong>
      </div>
      <div className="contact-stack">
        {(section.links ?? []).slice(0, 3).map((link) => (
          <span key={link.label}>
            {link.label}
            <small>{copy.contactState}</small>
          </span>
        ))}
      </div>
    </div>
  )
}

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
  const sectionPanelRef = useRef<HTMLElement | null>(null)
  const { content, locale, sections, setLocale } = useSiteContent()
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
    cubeSceneRef.current?.enterSection(id)
  }, [activeSectionId, syncSectionUrl])
  const [effects] = useState(() => readDiagnosticFx())
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }))
  const postProcessingEffects = [
    effects.bloom ? <Bloom key="bloom" intensity={0.58} luminanceThreshold={0.3} luminanceSmoothing={0.62} /> : null,
    effects.noise ? <Noise key="noise" opacity={0.025} /> : null,
    effects.vignette ? <Vignette key="vignette" eskil={false} offset={0.18} darkness={0.72} /> : null,
  ].filter((effect): effect is ReactElement => effect !== null)
  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? null,
    [activeSectionId, sections],
  )
  const displayedSection = useMemo(
    () => sections.find((section) => section.id === displayedSectionId) ?? activeSection,
    [activeSection, displayedSectionId, sections],
  )
  const activeSectionIndex = activeSection ? sections.findIndex((section) => section.id === activeSection.id) + 1 : 0
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
  const sectionCopy =
    locale === 'es'
      ? {
          highlights: 'Enfoque',
          proof: 'Evidencia',
          links: 'Enlaces',
          faces: 'Caras',
          signal: 'Señal',
          back: 'Volver al cubo',
          capabilities: ['Especificar', 'Prototipar', 'Validar', 'Publicar'],
          contactState: 'Listo',
          researchNodes: ['Verdad', 'Pensamiento', 'IA', 'Texto', 'Modelo'],
          securityControls: ['MFA', 'Límite', 'Secretos', 'Auditoría', 'WAF', 'Mínimo'],
          systemNodes: ['Legacy', 'Datos', 'API', 'Cloud', 'Observar'],
          artifacts: {
            agentic: 'Flujo agéntico',
            products: 'Prueba pública',
            systems: 'Arquitectura',
            security: 'Controles',
            research: 'Mapa conceptual',
            contact: 'Canales',
          },
        }
      : {
          highlights: 'Focus',
          proof: 'Evidence',
          links: 'Links',
          faces: 'Faces',
          signal: 'Signal',
          back: 'Back to cube',
          capabilities: ['Specify', 'Prototype', 'Verify', 'Ship'],
          contactState: 'Ready',
          researchNodes: ['Truth', 'Thought', 'AI', 'Text', 'Model'],
          securityControls: ['MFA', 'Rate', 'Secrets', 'Audit', 'WAF', 'Least'],
          systemNodes: ['Legacy', 'Data', 'API', 'Cloud', 'Observe'],
          artifacts: {
            agentic: 'Agentic flow',
            products: 'Public proof',
            systems: 'Architecture',
            security: 'Controls',
            research: 'Concept map',
            contact: 'Channels',
          },
        }

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
    sectionPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeSectionId])

  useEffect(() => {
    displayedSectionIdRef.current = displayedSectionId
  }, [displayedSectionId])

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

  useEffect(() => {
    if (!detailOpen) {
      return
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDetailOpen(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)

    return () => {
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [detailOpen])

  useEffect(() => {
    const panel = sectionPanelRef.current

    if (!panel) {
      return
    }

    function syncCardLight(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('.obsidian-card') : null

      if (!target) {
        return
      }

      const rect = target.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const normalizedX = (x / rect.width - 0.5) * 2
      const normalizedY = (y / rect.height - 0.5) * 2

      target.style.setProperty('--spotlight-x', `${x}px`)
      target.style.setProperty('--spotlight-y', `${y}px`)
      target.style.setProperty('--tilt-x', `${(-normalizedY * 1.15).toFixed(2)}deg`)
      target.style.setProperty('--tilt-y', `${(normalizedX * 1.15).toFixed(2)}deg`)
    }

    function resetCardLight(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('.obsidian-card') : null

      if (!target) {
        return
      }

      target.style.setProperty('--tilt-x', '0deg')
      target.style.setProperty('--tilt-y', '0deg')
    }

    panel.addEventListener('pointermove', syncCardLight)
    panel.addEventListener('pointerout', resetCardLight)

    return () => {
      panel.removeEventListener('pointermove', syncCardLight)
      panel.removeEventListener('pointerout', resetCardLight)
    }
  }, [activeSectionId])

  const fullscreenActive = ENABLE_FULLSCREEN_SECTION && activeSection !== null

  // Double-click on the background (not on the panels / nav / toggles) opens the
  // standalone wave-field showcase for the active face, e.g. ?bg=agentic.
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

  // Match the CSS mobile breakpoint (max-width: 900px or portrait-ish aspect).
  // On mobile the page scrolls and the cube hero takes its height from CSS, so we
  // stop pinning the shell and canvas to the viewport height.
  const isMobileViewport =
    viewport.width > 0 &&
    (viewport.width <= 900 || viewport.width / Math.max(1, viewport.height) <= 4 / 3)

  return (
    <main
      className={`prototype-shell is-${cursorMode} ${fullscreenActive ? 'has-section' : ''}`}
      aria-label="Premium cube prototype"
      onDoubleClick={handleBackgroundDoubleClick}
      style={{ width: viewport.width || '100vw', height: isMobileViewport ? undefined : viewport.height || '100vh' }}
    >
      <div
        className="cube-canvas"
        aria-hidden="true"
        style={{ width: viewport.width || '100vw', height: isMobileViewport ? undefined : viewport.height || '100vh' }}
      >
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
              sectionOpen={fullscreenActive}
              sections={sections}
              handleRef={cubeSceneRef}
            />
            {postProcessingEffects.length > 0 && (
              <EffectComposer multisampling={4}>{postProcessingEffects}</EffectComposer>
            )}
          </Suspense>
        </Canvas>
      </div>

      <div className="prototype-chrome">
        <div className="prototype-kicker">
          <span>{content.identity.displayName}</span>
          <small>{content.identity.role}</small>
        </div>
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

      {!ENABLE_FULLSCREEN_SECTION && displayedSection && (
        <SidePanels
          activeSection={displayedSection}
          locale={locale}
          onOpenDetail={(detail) => {
            setFocusedDetail(detail ?? null)
            setDetailOpen(true)
          }}
          transitionState={panelTransitionState}
        />
      )}

      {!ENABLE_FULLSCREEN_SECTION && displayedSection && (
        <CubeSectionNav
          activeSectionId={activeSectionId}
          fullName={content.identity.fullName}
          locale={locale}
          onSelectSection={requestFaceChange}
          sections={sections}
        />
      )}

      {detailOpen && activeDetail && (
        <div className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-modal-title">
          <button className="detail-modal__scrim" type="button" aria-label="Close detail" onClick={() => setDetailOpen(false)} />
          <article className="detail-modal__panel">
            <button className="detail-modal__close" type="button" onClick={() => setDetailOpen(false)}>
              ×
            </button>
            <p className="detail-modal__eyebrow">{activeSection?.label}</p>
            <h2 id="detail-modal-title">{activeDetail.title}</h2>
            <p className="detail-modal__summary">{activeDetail.summary}</p>
            {activeDetail.points && activeDetail.points.length > 0 && (
              <ul className="detail-modal__points">
                {activeDetail.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
            {activeDetail.links && activeDetail.links.length > 0 && (
              <div className="detail-modal__links">
                {activeDetail.links.map((link) =>
                  link.href ? (
                    <a href={link.href} key={link.label} rel="noreferrer" target="_blank">
                      <strong>{link.label}</strong>
                      {link.description && <span>{link.description}</span>}
                    </a>
                  ) : (
                    <span key={link.label}>
                      <strong>{link.label}</strong>
                      {link.description && <small>{link.description}</small>}
                    </span>
                  ),
                )}
              </div>
            )}
          </article>
        </div>
      )}

      <section className="section-panel" aria-hidden={!fullscreenActive} ref={sectionPanelRef}>
        {ENABLE_FULLSCREEN_SECTION && activeSection && (
          <div className="section-panel__inner">
            <span className="section-panel__aperture" aria-hidden="true" />

            <div className="section-panel__masthead">
              <div className="section-panel__index" aria-hidden="true">
                {String(activeSectionIndex).padStart(2, '0')}
              </div>
              <div className="section-panel__title-block">
                <p className="section-panel__eyebrow">{activeSection.eyebrow}</p>
                <h1>{activeSection.title}</h1>
              </div>
              <div className="section-panel__summary-block">
                <p className="section-panel__section-label">{activeSection.label}</p>
                <p className="section-panel__summary">{activeSection.summary}</p>
                <div className="section-panel__signal">
                  <span>{sectionCopy.signal}</span>
                  <div>
                    {sectionCopy.capabilities.map((capability, index) => (
                      <small key={capability}>
                        {String(index + 1).padStart(2, '0')} {capability}
                      </small>
                    ))}
                  </div>
                </div>
              </div>
              <SectionGlyph sectionId={activeSection.id} />
            </div>

            <div className="section-panel__body">
              <div className="section-panel__rail" aria-hidden="true" />
              <div className="section-panel__narrative">
                <FaceArtifact copy={sectionCopy} section={activeSection} />
                {activeSection.intro && <p className="section-panel__intro">{activeSection.intro}</p>}
                {activeSection.highlights && activeSection.highlights.length > 0 && (
                  <section className="section-panel__chapter" aria-label="Highlights">
                    <h2>{sectionCopy.highlights}</h2>
                    <div className="section-panel__content-grid">
                      {activeSection.highlights.map((highlight, index) => (
                        <article className="obsidian-card section-panel__highlight" key={highlight}>
                          <span className="obsidian-card__shine" aria-hidden="true" />
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <p>{highlight}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
                {activeSection.proofPoints && activeSection.proofPoints.length > 0 && (
                  <section className="section-panel__proof" aria-label="Proof points">
                    <h2>{sectionCopy.proof}</h2>
                    <ul>
                      {activeSection.proofPoints.map((proofPoint) => (
                        <li key={proofPoint}>{proofPoint}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {activeSection.links && activeSection.links.length > 0 && (
                  <section className="section-panel__links" aria-label={sectionCopy.links}>
                    <h2>{sectionCopy.links}</h2>
                    <div>
                      {activeSection.links.map((link) =>
                        link.href ? (
                          <a className="obsidian-card" href={link.href} key={link.label} rel="noreferrer" target="_blank">
                            <span className="obsidian-card__shine" aria-hidden="true" />
                            <span>{link.label}</span>
                            {link.description && <p>{link.description}</p>}
                          </a>
                        ) : (
                          <article className="obsidian-card" key={link.label}>
                            <span className="obsidian-card__shine" aria-hidden="true" />
                            <span>{link.label}</span>
                            {link.description && <p>{link.description}</p>}
                          </article>
                        ),
                      )}
                    </div>
                  </section>
                )}
                <div className="section-panel__actions">
                  {activeSection.cta?.href && (
                    <a className="section-panel__cta" href={activeSection.cta.href} rel="noreferrer" target="_blank">
                      {activeSection.cta.label}
                    </a>
                  )}
                  <button type="button" onClick={() => setActiveSectionId('agentic')}>
                    {sectionCopy.back}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
