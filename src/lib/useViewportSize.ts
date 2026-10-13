import { useEffect, useState } from 'react'

// The window's inner size, updated on resize and rotation.
export function useViewportSize(): { width: number; height: number } {
  const read = () => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  })
  const [size, setSize] = useState(read)

  useEffect(() => {
    const sync = () => setSize(read())
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  return size
}
