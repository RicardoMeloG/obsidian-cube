import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { IDLE_FPS } from './idleCadence'

/** With the canvas on `frameloop="demand"`, asks for a frame `fps` times a
 *  second, aligned to the display's refresh. A hidden tab gets no animation
 *  frames, so it draws nothing, as before. */
export function IdleTicker({ fps = IDLE_FPS }: { fps?: number }) {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    // A refresh lands a little early or late; 2 ms of slack keeps 30 on a
    // 60 Hz screen instead of falling to 20.
    const interval = 1000 / fps - 2
    let last = 0
    let raf = 0
    const tick = (now: number) => {
      if (now - last >= interval) {
        last = now
        invalidate()
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [fps, invalidate])
  return null
}
