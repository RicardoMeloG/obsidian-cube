import { useEffect, useRef } from 'react'
import { FACE_ORDER } from '@/kernel/faces'
import type { FaceId } from '@/kernel/faces'
import type { SiteLocale } from '@/kernel/siteContent'

// The face in the address bar: `?section=<face>&lang=<locale>`, so a link opens
// on the face it was copied from.
export function readInitialFace(): FaceId {
  if (typeof window === 'undefined') return 'agentic'
  const requested = new URLSearchParams(window.location.search).get('section')
  return FACE_ORDER.includes(requested as FaceId) ? (requested as FaceId) : 'agentic'
}

// Keeps the address in step with the face once the visitor changes it; the
// first render leaves the URL as it arrived.
export function useFaceUrl(face: FaceId, locale: SiteLocale) {
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
