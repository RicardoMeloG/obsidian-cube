import { WORLD_REGISTRY } from './registry'
import type { WorldId } from './catalog'

type VectorWorldStageProps = {
  worldId: WorldId | null
}

// Renders the world assigned to the active cube face (resolved from visual.json,
// honoring the enabled flag). A null worldId means the face has no background.
// Each world component owns its own embedded-mode defaults (position, scale,
// fog) so this container stays trivial.
export function VectorWorldStage({ worldId }: VectorWorldStageProps) {
  if (!worldId) return null
  const entry = WORLD_REGISTRY[worldId]
  if (!entry) return null
  const World = entry.Component
  return <World />
}
