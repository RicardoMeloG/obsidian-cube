import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import './threeConsole'
import type { ResolvedFace } from '@/kernel/visualContent'
import { playCubeNudgeSound } from '@/features/audio/cubeAudio'
import { useExperience, useExperienceStore } from '@/features/experience/experienceStore'
import { CUBE_ENGAGED_KEY, readFreezeAt, rememberInSession } from '@/features/experience/introPlan'
import type { IntroPlan } from '@/features/experience/introPlan'
import { ErrorBoundary } from '@/lib/ErrorBoundary'
import { CubeScene } from './CubeScene'
import type { CubeIntroConfig, CubeSceneHandle } from './CubeScene'
import { readDiagnosticFx } from './diagnosticFx'
import type { IntroPhase } from './intro/introTimeline'

type SceneLayerProps = {
  sections: ResolvedFace[]
  plan: IntroPlan
  webglAvailable: boolean
}

// The canvas draws once the scene reports its shaders compiled. If that never
// comes (a stalled compile, a lost context), it draws anyway after this long,
// compiling on the first frames as it did before.
const READY_TIMEOUT_MS = 3000

// The 3D scene, wired to the experience: it reports where the cube lands and
// what the visitor does with it, and turns the cube when a face is requested.
// Without WebGL, or if the scene fails, a still of the cube takes its place;
// the name, the composition and the dock are DOM and stay (ADR 006).
export function SceneLayer({ sections, plan, webglAvailable }: SceneLayerProps) {
  const store = useExperienceStore()
  const activeFace = useExperience((state) => state.activeFace)
  const requestedFace = useExperience((state) => state.requestedFace)
  const introSkipped = useExperience((state) => state.introSkipped)
  const nudged = useExperience((state) => state.nudge === 'shown')
  // Stage layout: the cube recedes while the visitor reads, and comes forward
  // during the intro, a face change, or when the visitor takes it.
  const recede = useExperience(
    (state) => state.layout === 'stage' && !state.explore && state.intro !== 'pending' && state.transition !== 'exiting',
  )
  const handleRef = useRef<CubeSceneHandle | null>(null)
  // Stage layout: a press that brings the receded cube forward only starts
  // exploring; it does not also pick the face under the pointer.
  const grabStartedExploreRef = useRef(false)
  const [effects] = useState(() => readDiagnosticFx())
  const intro = useMemo<CubeIntroConfig>(
    () => ({
      play: plan.play,
      returnTurn: !plan.play && plan.showHint && !plan.reducedMotion,
      freezeAt: import.meta.env.DEV && typeof window !== 'undefined' ? readFreezeAt(window.location.search) : null,
    }),
    [plan],
  )

  // A requested face: the scene turns the cube and reports it on landing. If
  // the scene is not there to turn it, the face changes at once.
  useEffect(() => {
    if (!requestedFace) return
    grabStartedExploreRef.current = false
    if (handleRef.current) handleRef.current.enterSection(requestedFace)
    else store.dispatch({ type: 'faceEntered', face: requestedFace })
  }, [requestedFace, store])

  useEffect(() => {
    if (introSkipped) handleRef.current?.skipIntro()
  }, [introSkipped])

  // The cube's call, with the bubble that invites the first click.
  useEffect(() => {
    if (nudged) void playCubeNudgeSound()
  }, [nudged])

  // The landing starts the staged reveal of the interface.
  const handleIntroPhase = useCallback(
    (phase: IntroPhase) => {
      if (phase === 'landed' || phase === 'done') store.dispatch({ type: 'introLanded' })
    },
    [store],
  )
  const handleEngaged = useCallback(() => {
    store.dispatch({ type: 'visitorEngaged' })
    rememberInSession(CUBE_ENGAGED_KEY)
  }, [store])

  const [ready, setReady] = useState(false)
  const handleReady = useCallback(() => setReady(true), [])
  useEffect(() => {
    const timeout = window.setTimeout(() => setReady(true), READY_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [])

  const poster = <img className="cube-canvas__poster block size-full object-cover" src="/og-image.jpg" alt="" />
  if (!webglAvailable) return poster

  return (
    <ErrorBoundary label="3D scene" fallback={poster} onError={() => store.dispatch({ type: 'sceneFailed' })}>
      <Canvas
        camera={{ position: [0, 1.05, 6.8], fov: 42, near: 0.1, far: 80 }}
        dpr={[1.5, 2]}
        frameloop={ready ? 'always' : 'never'}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', stencil: true }}
        shadows={effects.shadows}
        onCreated={() => store.dispatch({ type: 'sceneMounted' })}
      >
        <Suspense fallback={null}>
          <CubeScene
            activeSectionId={activeFace}
            effects={effects}
            onCursorModeChange={(cursor) => {
              store.dispatch({ type: 'cursorChanged', cursor })
              if (cursor !== 'grabbing') return
              const state = store.getState()
              grabStartedExploreRef.current = state.layout === 'stage' && !state.explore
              store.dispatch({ type: 'exploreStarted' })
            }}
            onSectionEnter={(face) => {
              const startedExplore = grabStartedExploreRef.current
              grabStartedExploreRef.current = false
              if (!startedExplore) store.dispatch({ type: 'faceEntered', face })
            }}
            sections={sections}
            handleRef={handleRef}
            intro={intro}
            onIntroPhase={handleIntroPhase}
            onEngaged={handleEngaged}
            recede={recede}
            onReady={handleReady}
          />
        </Suspense>
      </Canvas>
    </ErrorBoundary>
  )
}
