import { useMemo } from 'react'
import { VectorPlexusField } from '../base/VectorPlexusField'
import { createWaveGpu, waveDisplacement } from './agenticWave'
import type { WorldProps } from '../types'

// ── AgenticWorld ──────────────────────────────────────────────────────────────
// Plexus wave field — the base visual language for the whole site.
// Delegates 100% to VectorPlexusField; the wave math lives in agenticWave.ts
// and this file sets the canonical position/rotation for this face.

export function AgenticWorld({
  position = [0, -1.5, -3.5],
  rotation = [-Math.PI / 2.35, 0, 0],
  paused = false,
}: WorldProps = {}) {
  // One per field: two canvases (the stage and art mode) keep their own clocks.
  const waveGpu = useMemo(() => createWaveGpu(), [])
  return (
    <VectorPlexusField
      displacement={waveDisplacement}
      gpuDisplacement={waveGpu}
      animated
      horizonGlow
      parallax
      position={position as [number, number, number]}
      rotation={rotation as [number, number, number]}
      paused={paused}
    />
  )
}
