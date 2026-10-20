import { useEffect } from 'react'
import { useExperience, useExperienceStore } from './experienceStore'
import { NUDGE_SEEN_KEY, rememberForGood } from './introPlan'

// How long the cube waits untouched before it invites a click, and how long
// the invitation stays.
const NUDGE_DELAY_MS = 3000
const NUDGE_SHOW_MS = 6000

// The nudge's clock: once the cube has waited untouched on the stage for a
// moment (after the intro, no face changing, no dialog, nobody holding it), the
// invitation shows, recorded for good; it leaves after a while or as soon as
// the visitor acts. The scene plays its call, the DOM draws the bubble.
export function useCubeNudge() {
  const store = useExperienceStore()
  const nudge = useExperience((state) => state.nudge)
  const waiting = useExperience(
    (state) =>
      state.layout === 'stage' &&
      state.sceneReady &&
      state.intro === 'done' &&
      state.transition === 'idle' &&
      !state.detail.open &&
      state.cursor !== 'grabbing',
  )

  useEffect(() => {
    if (nudge === 'done') return
    if (!waiting) {
      if (nudge === 'shown') store.dispatch({ type: 'nudgeEnded' })
      return
    }
    const shown = nudge === 'shown'
    const timer = window.setTimeout(() => {
      if (!shown) rememberForGood(NUDGE_SEEN_KEY)
      store.dispatch({ type: shown ? 'nudgeEnded' : 'nudgeShown' })
    }, shown ? NUDGE_SHOW_MS : NUDGE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [nudge, waiting, store])
}
