import { useEffect, useRef } from 'react'
import { FACE_ORDER } from '@/kernel/faces'
import type { FaceId } from '@/kernel/faces'
import type { SiteLocale } from '@/kernel/siteContent'

// The face in the address bar: `?section=<face>&lang=<locale>`, so a link opens
// on the face it was copied from.
function faceInUrl(): FaceId | null {
  if (typeof window === 'undefined') return null
  const requested = new URLSearchParams(window.location.search).get('section')
  return FACE_ORDER.includes(requested as FaceId) ? (requested as FaceId) : null
}

export function readInitialFace(): FaceId {
  return faceInUrl() ?? 'agentic'
}

// A link to a face opens on its content; the bare address, on the cube.
export function urlNamesFace(): boolean {
  return faceInUrl() !== null
}

// Keeps the address in step with the face once the visitor changes it; until
// then the URL stays as it arrived, so the bare address keeps opening on the
// cube. Compared with what was shown, not counted by renders: development runs
// each effect twice.
export function useFaceUrl(face: FaceId, locale: SiteLocale) {
  const shown = useRef({ face, locale })
  useEffect(() => {
    if (shown.current.face === face && shown.current.locale === locale) return
    shown.current = { face, locale }
    const url = new URL(window.location.href)
    url.searchParams.set('section', face)
    url.searchParams.set('lang', locale)
    window.history.replaceState({}, '', url)
  }, [face, locale])
}
