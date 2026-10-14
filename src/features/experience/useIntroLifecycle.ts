import { useEffect } from 'react'
import { useExperience, useExperienceStore } from './experienceStore'
import { INTRO_SEEN_KEY, rememberInSession } from './introPlan'
import type { IntroPlan } from './introPlan'

// If the scene never reports its landing (slow load), the interface still appears.
const INTRO_SAFETY_MS = 4000
// Long enough for the last staged element (the hint: 1100ms delay + 600ms fade).
const REVEAL_MS = 2000

// The intro's clock outside the scene: marks it seen for the session, reveals
// the interface even without a landing, settles the staged reveal, and lets any
// input skip it.
export function useIntroLifecycle(plan: IntroPlan) {
  const store = useExperienceStore()
  const intro = useExperience((state) => state.intro)

  useEffect(() => {
    if (!plan.play) return
    rememberInSession(INTRO_SEEN_KEY)
    const safety = window.setTimeout(() => store.dispatch({ type: 'introLanded' }), INTRO_SAFETY_MS)
    return () => window.clearTimeout(safety)
  }, [plan.play, store])

  useEffect(() => {
    if (intro !== 'reveal') return
    const settle = window.setTimeout(() => store.dispatch({ type: 'introSettled' }), REVEAL_MS)
    return () => window.clearTimeout(settle)
  }, [intro, store])

  const running = intro !== 'done'
  useEffect(() => {
    if (!running) return
    const skip = () => store.dispatch({ type: 'introSkipped' })
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    window.addEventListener('wheel', skip, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('wheel', skip)
    }
  }, [running, store])
}
