import { useMemo } from 'react'
import { AdditiveBlending } from 'three'
import { createHorizonGlowTexture } from '../base/textures'
import { VECTOR_WORLD_THEME } from '../base/theme'
import type { WorldProps } from '../types'

// Minimal placeholder used by world stubs while their geometry is being designed.
// Renders a subtle horizon glow so the face is not visually empty but commits to
// no specific composition. Replace per-world by writing the world file from scratch.
export function PlaceholderWorld({
  position = [0, -1.5, -3.5],
  rotation = [-Math.PI / 2.35, 0, 0],
}: WorldProps = {}) {
  const horizonTexture = useMemo(
    () => createHorizonGlowTexture(VECTOR_WORLD_THEME.horizonGlowColor),
    [],
  )

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 12, -0.4]} rotation={[Math.PI / 2.1, 0, 0]}>
        <planeGeometry args={[28, 10]} />
        <meshBasicMaterial
          map={horizonTexture}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
