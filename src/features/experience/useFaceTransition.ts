import { useEffect } from 'react'
import { useExperience, useExperienceStore } from './experienceStore'

// The rails' face change: they fade out, swap to the new face half way, then
// rise in (the motion itself is CSS, src/features/faces/FaceRails.css).
const SWAP_MS = 150
const SETTLE_MS = 430

export function useFaceTransition() {
  const store = useExperienceStore()
  const activeFace = useExperience((state) => state.activeFace)

  useEffect(() => {
    if (store.getState().transition !== 'exiting') return
    const swap = window.setTimeout(() => store.dispatch({ type: 'panelsSwapped' }), SWAP_MS)
    const settle = window.setTimeout(() => store.dispatch({ type: 'transitionFinished' }), SETTLE_MS)
    // A new face before the end restarts the transition towards it.
    return () => {
      window.clearTimeout(swap)
      window.clearTimeout(settle)
    }
  }, [activeFace, store])
}
