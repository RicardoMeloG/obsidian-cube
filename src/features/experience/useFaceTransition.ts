import { useEffect } from 'react'
import { useExperience, useExperienceStore } from './experienceStore'

// The content's face change: they fade out, swap to the new face half way, then
// rise in (the motion itself is CSS, src/features/faces/FaceRails.css).
const SWAP_MS = 150
const SETTLE_MS = 430
// Stage layout: the swap waits while the cube comes forward and turns.
const STAGE_SWAP_MS = 620
const STAGE_SETTLE_MS = 1080

export function useFaceTransition() {
  const store = useExperienceStore()
  const activeFace = useExperience((state) => state.activeFace)

  useEffect(() => {
    const { transition, layout } = store.getState()
    if (transition !== 'exiting') return
    const stage = layout === 'stage'
    const swap = window.setTimeout(() => store.dispatch({ type: 'panelsSwapped' }), stage ? STAGE_SWAP_MS : SWAP_MS)
    const settle = window.setTimeout(() => store.dispatch({ type: 'transitionFinished' }), stage ? STAGE_SETTLE_MS : SETTLE_MS)
    // A new face before the end restarts the transition towards it.
    return () => {
      window.clearTimeout(swap)
      window.clearTimeout(settle)
    }
  }, [activeFace, store])
}
