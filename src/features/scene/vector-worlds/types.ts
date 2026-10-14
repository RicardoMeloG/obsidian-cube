import type { ComponentType, LazyExoticComponent } from 'react'

export type WorldProps = {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  paused?: boolean
  // Emissive multiplier. Embedded behind the cube wants a whisper (the scene's
  // bloom amplifies it); the standalone showcase wants the full spectacle.
  glow?: number
  // Secondary emissive multiplier for foreground motion (e.g. projectiles) that
  // should stay legible even when the ambient `glow` is dialed down.
  projGlow?: number
}

export type WorldCamera = {
  position: readonly [number, number, number]
  fov: number
  near: number
  far: number
}

export type WorldFog = {
  near: number
  far: number
}

export type WorldComposition = {
  // Max fraction of vertical viewport occupied by visible terrain.
  maxTerrainCoverage: number
  // Expected horizon band in screen space (0 top, 1 bottom).
  horizonBand: readonly [number, number]
  // Screen-space pole for sky trails.
  poleScreen: readonly [number, number]
  // Reference aspect used while tuning composition.
  targetAspect: number
}

// Showcase config lets the standalone preview (?bg=<id>) override world defaults
// that are tuned for embedded mode inside the cube scene.
export type WorldShowcaseConfig = {
  camera: WorldCamera
  fog: WorldFog
  // Optional target the camera should look at each frame. Useful when a world
  // wants the showcase to tilt up (sky-dominant) instead of looking at origin.
  lookAt?: readonly [number, number, number]
  composition?: WorldComposition
  props?: WorldProps
}

export type WorldEntry = {
  id: string
  label: string
  caption: string
  Component: ComponentType<WorldProps> | LazyExoticComponent<ComponentType<WorldProps>>
  showcase: WorldShowcaseConfig
}
