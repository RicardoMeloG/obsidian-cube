import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, Color } from 'three'
import type { Mesh, MeshBasicMaterial } from 'three'
import { ringProgress } from './introTimeline'

// Thin violet ring that expands from the platform center to its edge and fades
// when the cube lands (specs/009-cube-intro). Lives inside the platform group,
// so it inherits the platform's scale and height.
const START_RADIUS = 0.6
const END_RADIUS = 2.65
const RING_COLOR = new Color('#b8aeff')

export function LandingRing({ getTime }: { getTime: () => number }) {
  const meshRef = useRef<Mesh>(null)

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const progress = ringProgress(getTime())
    mesh.visible = progress !== null
    if (progress === null) return

    const eased = 1 - (1 - progress) ** 3
    mesh.scale.setScalar(START_RADIUS + (END_RADIUS - START_RADIUS) * eased)
    ;(mesh.material as MeshBasicMaterial).opacity = 0.7 * (1 - progress) ** 1.5
  })

  return (
    <mesh ref={meshRef} position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      {/* Unit radius; the thickness reads ~2% of the radius at any scale. */}
      <ringGeometry args={[0.98, 1, 160]} />
      <meshBasicMaterial
        color={RING_COLOR}
        transparent
        opacity={0}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}
