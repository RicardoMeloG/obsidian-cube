import { VectorPlexusField } from '../base/VectorPlexusField'
import type { WorldProps } from '../types'

// ── Wave displacement ─────────────────────────────────────────────────────────
// Seven-octave sin sum that drives the flowing wave surface.
// Identical to the original WaveField formula — only the render logic moved
// into the shared VectorPlexusField base.

const WAVE_OCTAVES = [
  [0.36, 0,     0.6,  0,   0.16],
  [0,    0.44,  0.78, 1.3, 0.2 ],
  [0.7,  0.55,  1.05, 0.8, 0.15],
  [1.15, 0,     1.45, 0,   0.09],
  [0,    1.32,  1.3,  2.1, 0.09],
  [1.9,  -1.9,  1.85, 0,   0.06],
  [2.4,  -1.9,  2.2,  0.4, 0.05],
] as const

const WAVE_TIME_SCALE = 0.45

function waveDisplacement(x: number, y: number, t: number): number {
  const tt = t * WAVE_TIME_SCALE
  let z = 0
  for (const [freqX, freqY, freqT, phase, amp] of WAVE_OCTAVES) {
    z += Math.sin(freqX * x + freqY * y + freqT * tt + phase) * amp
  }
  return z
}

// ── AgenticWorld ──────────────────────────────────────────────────────────────
// Plexus wave field — the base visual language for the whole site.
// Delegates 100% to VectorPlexusField; this file only defines the wave math
// and the canonical position/rotation for this face.

export function AgenticWorld({
  position = [0, -1.5, -3.5],
  rotation = [-Math.PI / 2.35, 0, 0],
  paused = false,
}: WorldProps = {}) {
  return (
    <VectorPlexusField
      displacement={waveDisplacement}
      animated
      horizonGlow
      parallax
      position={position as [number, number, number]}
      rotation={rotation as [number, number, number]}
      paused={paused}
    />
  )
}
