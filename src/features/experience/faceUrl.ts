import { useEffect, useRef } from 'react'
import { CUBE_FACE_ORDER } from '@/kernel/faces'
import type { CubeSectionId } from '@/kernel/faces'
import type { SiteLocale } from '@/kernel/siteContent'

// The face in the address bar: `?section=<face>&lang=<locale>`, so a link opens
// on the face it was copied from.
export function readInitialFace(): CubeSectionId {
  if (typeof window === 'undefined') return 'agentic'
  const requested = new URLSearchParams(window.location.search).get('section')
  return CUBE_FACE_ORDER.includes(requested as CubeSectionId) ? (requested as CubeSectionId) : 'agentic'
}

// Keeps the address in step with the face once the visitor changes it; the
// first render leaves the URL as it arrived.
export function useFaceUrl(face: CubeSectionId, locale: SiteLocale) {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.set('section', face)
    url.searchParams.set('lang', locale)
    window.history.replaceState({}, '', url)
  }, [face, locale])
}
