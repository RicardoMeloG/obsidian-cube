import { useEffect, useMemo } from 'react'
import { AdditiveBlending } from 'three'
import { buildTickSectors } from './tickRing'
import type { TickRingOptions } from './tickRing'

/** One ring of ticks on the pedestal, one draw call per sector (tickRing.ts). */
export function PlatformTicks({ radius, count, faint = false }: TickRingOptions) {
  const sectors = useMemo(() => buildTickSectors({ radius, count, faint }), [radius, count, faint])
  useEffect(() => () => sectors.forEach((sector) => sector.geometry.dispose()), [sectors])
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.41, 0]}>
      {sectors.map((sector, i) => (
        <mesh key={i} geometry={sector.geometry} position={[sector.center[0], sector.center[1], 0]}>
          <meshBasicMaterial vertexColors transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
