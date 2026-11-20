import { Suspense, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import type { Group } from 'three'
import { ErrorBoundary } from '@/lib/ErrorBoundary'
import type { WorldId } from '@/kernel/worlds'
import { VECTOR_WORLD_THEME } from './vector-worlds/base/theme'
import { WORLD_REGISTRY } from './vector-worlds/registry'
import { ShowcaseCamera, ShowcaseLookAt } from './vector-worlds/showcaseFraming'
import { showcaseExtraProps } from './vector-worlds/showcaseProps'

type ArtModeCanvasProps = {
  worldId: WorldId
  // Called once the world can be drawn, or once it has failed: the veil over
  // the canvas lifts then, never on a half-compiled first frame. Keep it stable.
  onReady: () => void
}

// The face's world alone, framed as in its showcase (ADR 001, spec 017): the
// same camera, look-at, fog and props the owner tuned in the dev showcase,
// without the cube, the pedestal or the interface. It runs at full quality:
// while it is on, the cube scene's canvas is paused (SceneLayer), so only one
// canvas draws.
export function ArtModeCanvas({ worldId, onReady }: ArtModeCanvasProps) {
  const { Component, showcase } = WORLD_REGISTRY[worldId]
  return (
    <Canvas
      camera={showcase.camera}
      dpr={[1.25, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', stencil: true }}
    >
      <color attach="background" args={[VECTOR_WORLD_THEME.background]} />
      <fog attach="fog" args={[VECTOR_WORLD_THEME.background, showcase.fog.near, showcase.fog.far]} />
      <ambientLight intensity={0.18} />
      <ShowcaseCamera worldId={worldId} baseCamera={showcase.camera} composition={showcase.composition} />
      {showcase.lookAt && <ShowcaseLookAt target={showcase.lookAt} composition={showcase.composition} />}
      <ErrorBoundary label={`Art mode "${worldId}"`} fallback={null} onError={onReady}>
        <Suspense fallback={null}>
          <Compiled onCompiled={onReady}>
            <Component {...(showcase.props ?? {})} {...showcaseExtraProps(worldId)} />
          </Compiled>
        </Suspense>
      </ErrorBoundary>
    </Canvas>
  )
}

// Compiles the world's shaders off the main thread before it shows (the same
// approach as VectorWorldStage), so the art does not appear stuttering.
function Compiled({ children, onCompiled }: { children: ReactNode; onCompiled: () => void }) {
  const groupRef = useRef<Group>(null)
  const get = useThree((state) => state.get)

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    let cancelled = false
    const settle = () => {
      if (!cancelled) onCompiled()
    }
    const { gl, scene, camera } = get()
    gl.compileAsync(group, camera, scene).then(settle, settle)
    return () => {
      cancelled = true
    }
  }, [get, onCompiled])

  return <group ref={groupRef}>{children}</group>
}
