import type { CubeSectionId } from '../../cubeSections'
import { WORLD_REGISTRY } from './registry'

type VectorWorldStageProps = {
  activeSectionId: CubeSectionId
}

// Renders the world bound to the active cube face. Each world component owns
// its own embedded-mode defaults (position, scale, fog handling) so this
// container stays trivial.
export function VectorWorldStage({ activeSectionId }: VectorWorldStageProps) {
  const entry = WORLD_REGISTRY[activeSectionId]
  if (!entry) return null
  const World = entry.Component
  return <World />
}
