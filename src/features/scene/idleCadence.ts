import { useEffect, useRef, useState } from 'react'
import { useExperience } from '@/features/experience/experienceStore'

// Idle cadence (dt-12, C-2 of the load audit of 2026-11-14). The scene drew at
// the screen's full rate forever, 55 to 68 frames a second (144 on a 144 Hz
// screen) while nobody touched anything: 21 % of a core at rest on a fast
// desktop, 94 % with the CPU slowed 4×. After a few seconds without input, and
// only when nothing in the scene is meant to move fast, it draws at 30 frames a
// second; any input brings the full rate back at once. The worlds keep moving:
// their motion follows the clock, not the frame count, so it is the same motion
// sampled less often. The art mode is not touched: contemplating never slows
// down (spec 017, D-6), and its own canvas does not use this.

/** Input that ends the rest: the pointer, a key, a wheel or a touch. */
const INPUT_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const
export const IDLE_AFTER_MS = 5000
export const IDLE_FPS = 30

/** Whether the scene has something of its own to animate fast: the intro, a
 *  face change, the cube held or turning, its call to the visitor. `explore`
 *  is not one: the stage opens in cube mode, so it is the resting state too;
 *  holding the cube shows as the grabbing cursor, and entering or leaving cube
 *  mode is input. */
export function useSceneBusy() {
  return useExperience(
    (state) =>
      state.intro !== 'done' ||
      state.transition !== 'idle' ||
      state.requestedFace !== null ||
      state.cursor === 'grabbing' ||
      state.nudge === 'shown',
  )
}

/** True once there has been no input for `IDLE_AFTER_MS` and the scene is not
 *  busy. The scene leaving a busy state counts as activity, so a face change
 *  or the cube receding finishes at full rate before the rest starts. */
export function useSceneIdle(busy: boolean, idleAfterMs = IDLE_AFTER_MS) {
  const [idle, setIdle] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)
  const idleRef = useRef(false)
  useEffect(() => {
    const arm = () => {
      window.clearTimeout(timerRef.current)
      if (idleRef.current) {
        idleRef.current = false
        setIdle(false)
      }
      if (busy) return
      timerRef.current = window.setTimeout(() => {
        idleRef.current = true
        setIdle(true)
      }, idleAfterMs)
    }
    arm()
    for (const name of INPUT_EVENTS) window.addEventListener(name, arm, { passive: true })
    return () => {
      window.clearTimeout(timerRef.current)
      for (const name of INPUT_EVENTS) window.removeEventListener(name, arm)
    }
  }, [busy, idleAfterMs])
  return idle
}
