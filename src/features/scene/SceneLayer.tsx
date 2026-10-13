import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import type { ResolvedFace } from '@/kernel/visualContent'
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

// The 3D scene, wired to the experience: it reports where the cube lands and
// what the visitor does with it, and turns the cube when a face is requested.
// Without WebGL, or if the scene fails, a still of the cube takes its place;
// the name, rails and strip are DOM and stay (ADR 006).
export function SceneLayer({ sections, plan, webglAvailable }: SceneLayerProps) {
  const store = useExperienceStore()
  const activeFace = useExperience((state) => state.activeFace)
  const requestedFace = useExperience((state) => state.requestedFace)
  const introSkipped = useExperience((state) => state.introSkipped)
  const handleRef = useRef<CubeSceneHandle | null>(null)
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
    if (handleRef.current) handleRef.current.enterSection(requestedFace)
    else store.dispatch({ type: 'faceEntered', face: requestedFace })
  }, [requestedFace, store])

  useEffect(() => {
    if (introSkipped) handleRef.current?.skipIntro()
  }, [introSkipped])

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

  const poster = <img className="cube-canvas__poster block size-full object-cover" src="/og-image.jpg" alt="" />
  if (!webglAvailable) return poster

  return (
    <ErrorBoundary label="3D scene" fallback={poster} onError={() => store.dispatch({ type: 'sceneFailed' })}>
      <Canvas
        camera={{ position: [0, 1.05, 6.8], fov: 42, near: 0.1, far: 80 }}
        dpr={[1.5, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', stencil: true }}
        shadows={effects.shadows}
        onCreated={() => store.dispatch({ type: 'sceneMounted' })}
      >
        <Suspense fallback={null}>
          <CubeScene
            activeSectionId={activeFace}
            effects={effects}
            onCursorModeChange={(cursor) => store.dispatch({ type: 'cursorChanged', cursor })}
            onSectionEnter={(face) => store.dispatch({ type: 'faceEntered', face })}
            sections={sections}
            handleRef={handleRef}
            intro={intro}
            onIntroPhase={handleIntroPhase}
            onEngaged={handleEngaged}
          />
        </Suspense>
      </Canvas>
    </ErrorBoundary>
  )
}
