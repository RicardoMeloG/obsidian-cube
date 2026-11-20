import { glslFloat } from '../base/plexusGpu'
import type { PlexusGpuDisplacement } from '../base/plexusGpu'

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

export function waveDisplacement(x: number, y: number, t: number): number {
  const tt = t * WAVE_TIME_SCALE
  let z = 0
  for (const [freqX, freqY, freqT, phase, amp] of WAVE_OCTAVES) {
    z += Math.sin(freqX * x + freqY * y + freqT * tt + phase) * amp
  }
  return z
}

// The same wave for the shaders (dt-12): each octave's time term is folded
// into a phase on the CPU, in double precision and wrapped to one turn, so
// the GPU's single-precision sin never sees a large argument however long
// the page stays open.
const TURN = Math.PI * 2

export function waveTimePhases(t: number, out: Float32Array = new Float32Array(WAVE_OCTAVES.length)): Float32Array {
  const tt = t * WAVE_TIME_SCALE
  WAVE_OCTAVES.forEach(([, , freqT, phase], i) => {
    out[i] = (freqT * tt + phase) % TURN
  })
  return out
}

export const WAVE_GLSL = /* glsl */ `
  uniform float uWavePhase[${WAVE_OCTAVES.length}];
  float plexusDisplacement(vec2 p) {
    float z = 0.0;
${WAVE_OCTAVES.map(([freqX, freqY, , , amp], i) => `    z += sin(${glslFloat(freqX)} * p.x + ${glslFloat(freqY)} * p.y + uWavePhase[${i}]) * ${glslFloat(amp)};`).join('\n')}
    return z;
  }
`

export function createWaveGpu(): PlexusGpuDisplacement {
  const phases = waveTimePhases(0)
  return { glsl: WAVE_GLSL, uniforms: { uWavePhase: { value: phases } }, update: (t) => void waveTimePhases(t, phases) }
}
