// Single source of truth for every vector world.
// Tune values here to shift the look of all backgrounds at once: color, density,
// point size, opacity, atmospheric depth fade. Worlds may override locally for
// design reasons but should start from these tokens.

export const VECTOR_WORLD_THEME = {
  background: '#08050d',

  // Palette
  lineColorRgb: [0x74 / 255, 0x45 / 255, 0xff / 255] as const,
  particleColor: '#9d7bff',
  horizonGlowColor: '#7956ff',
  lampGlowColor: '#f3f2f8',

  // Density / scale
  pointSizeFactor: 30.0,
  pointAlphaBase: 0.32,
  pointAlphaCrest: 0.42,
  lineGlobalIntensity: 0.6,

  // Atmospheric depth fade — kept consistent across worlds so the violet
  // ambient reads the same regardless of geometry.
  depthFadeNear: 4.0,
  depthFadeFar: 20.0,

  // Crest boost — for height-driven highlight (used by world shaders that
  // accentuate peaks or vertical features).
  crestBoostLow: -0.2,
  crestBoostHigh: 0.85,
} as const

export type VectorWorldTheme = typeof VECTOR_WORLD_THEME
