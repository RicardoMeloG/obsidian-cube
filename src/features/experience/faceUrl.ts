import { useEffect, useRef } from 'react'
import type { FaceId } from '@/kernel/faces'
import { pageTitle } from '@/kernel/seo/renderSeo'
import type { SiteContent } from '@/kernel/siteContent'
import { pagePath, readPagePath } from '@/kernel/sitePaths'

// The page in the address bar (src/kernel/sitePaths.ts): `/security` or
// `/es/seguridad` names a face, so a link opens on the face it was copied
// from; the bare `/` or `/es` opens on the cube.
function faceInUrl(): FaceId | null {
  if (typeof window === 'undefined') return null
  return readPagePath(window.location.pathname)?.face ?? null
}

export function readInitialFace(): FaceId {
  return faceInUrl() ?? 'agentic'
}

// A link to a face opens on its content; the bare address, on the cube.
export function urlNamesFace(): boolean {
  return faceInUrl() !== null
}

// Keeps the address and the title on the page the visitor sees: its language
// always, its face once the visitor has picked one (or arrived on it), so the
// bare address keeps opening on the cube. Both follow the content, not the
// request, so they never name a language the page does not show yet; the
// title waits for the published content (`ready`), since the bundled example
// names someone else. Compared with what was shown, not counted by renders:
// development runs each effect twice. Query parameters (the review's
// `?intro=0`) are kept.
export function useFaceUrl(face: FaceId, explore: boolean, content: SiteContent, ready: boolean) {
  const shown = useRef({ face, explore, named: urlNamesFace() })
  useEffect(() => {
    const was = shown.current
    const named = was.named || was.face !== face || (was.explore && !explore)
    shown.current = { face, explore, named }
    const page = { locale: content.locale, face: named ? face : null }
    if (ready) document.title = pageTitle(content, page.face)
    const path = pagePath(page)
    if (window.location.pathname !== path) window.history.replaceState(window.history.state, '', `${path}${window.location.search}${window.location.hash}`)
  }, [face, explore, content, ready])
}
