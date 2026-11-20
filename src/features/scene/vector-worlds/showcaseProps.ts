import type { WorldId } from '@/kernel/worlds'

// Props a world takes only when it is shown on its own, outside the cube
// scene (the dev showcase and the art mode, spec 017): the systems world owns
// its look-at and draws extra fog lines.
export function showcaseExtraProps(worldId: WorldId): Record<string, unknown> {
  return worldId === 'systems' ? { controlsCamera: true, fogLines: true, skylineDepthTest: false } : {}
}
