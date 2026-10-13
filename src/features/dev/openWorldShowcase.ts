import type { MouseEvent } from 'react'
import type { FaceId } from '@/kernel/faces'

// Development only: a double-click on the background (not on the interface)
// opens the standalone showcase of the face's world (?bg=<world>). The
// visitor-facing fullscreen art mode of ADR 001 is still pending.
export function openWorldShowcase(event: MouseEvent<HTMLElement>, face: FaceId) {
  const target = event.target as HTMLElement
  if (target.closest('.face-rails__rail, .face-strip, .language-toggle, .identity-chrome, dialog, button, a')) return
  const params = new URLSearchParams(window.location.search)
  params.set('bg', face)
  window.location.search = `?${params.toString()}`
}
