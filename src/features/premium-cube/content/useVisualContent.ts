import { useEffect, useState } from 'react'
import { getDefaultVisualContent, loadVisualContent } from './visualContent'
import type { VisualContent } from './visualContent'

// Loads the language-independent visual config once. Starts from embedded
// defaults (identical to the previous hardcoded look) so there is no flash
// before visual.json / visual.example.json resolves.
export function useVisualContent(): VisualContent {
  const [visual, setVisual] = useState<VisualContent>(getDefaultVisualContent)

  useEffect(() => {
    let isCurrent = true

    void loadVisualContent().then((loaded) => {
      if (isCurrent) {
        setVisual(loaded)
      }
    })

    return () => {
      isCurrent = false
    }
  }, [])

  return visual
}
