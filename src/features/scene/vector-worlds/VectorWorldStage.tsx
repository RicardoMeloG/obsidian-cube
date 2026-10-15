import { Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import type { Group } from 'three'
import { ErrorBoundary } from '@/lib/ErrorBoundary'
import { WORLD_REGISTRY } from './registry'
import type { WorldId } from '@/kernel/worlds'

type VectorWorldStageProps = {
  worldId: WorldId | null
  // Called once the world can be drawn, or once it has failed.
  onSettled?: () => void
}

// Renders the world assigned to the active cube face (resolved from visual.json,
// honoring the enabled flag). A null worldId means the face has no background.
// Each world component owns its own embedded-mode defaults (position, scale,
// fog) so this container stays trivial. Worlds are lazy chunks, hence Suspense:
// the scene keeps rendering while the chunk downloads. A world that fails to
// load or render leaves the face without background; the cube stays (ADR 006).
// The key gives every world a fresh boundary.
export function VectorWorldStage({ worldId, onSettled }: VectorWorldStageProps) {
  if (!worldId) return null
  const entry = WORLD_REGISTRY[worldId]
  if (!entry) return null
  const World = entry.Component
  return (
    <ErrorBoundary key={worldId} label={`World "${worldId}"`} fallback={null} onError={onSettled}>
      <Suspense fallback={null}>
        <CompiledGroup onCompiled={onSettled}>
          <World />
        </CompiledGroup>
      </Suspense>
    </ErrorBoundary>
  )
}

// Keeps the world hidden until its shaders are compiled. compileAsync compiles
// them off the main thread (KHR_parallel_shader_compile), so the cube keeps
// moving while a new face's world is prepared instead of the page freezing on
// the first frame that draws it. Hidden objects are still compiled.
function CompiledGroup({ children, onCompiled }: { children: ReactNode; onCompiled?: () => void }) {
  const groupRef = useRef<Group>(null)
  const get = useThree((state) => state.get)
  const [compiled, setCompiled] = useState(false)

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    let cancelled = false
    const settle = () => {
      if (cancelled) return
      setCompiled(true)
      onCompiled?.()
    }
    const { gl, scene, camera } = get()
    gl.compileAsync(group, camera, scene).then(settle, settle)
    return () => {
      cancelled = true
    }
  }, [get, onCompiled])

  return (
    <group ref={groupRef} visible={compiled}>
      {children}
    </group>
  )
}
