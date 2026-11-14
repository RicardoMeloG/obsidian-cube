import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { WorldId } from '@/kernel/worlds'
import type { InterfaceCopy } from '@/features/content/copy'
import { ArtModeCanvas } from '@/features/scene/ArtModeCanvas'
import { cx } from '@/ui/cx'
import './artMode.css'

// How long the veil takes to cover or uncover. SceneLayer pauses the cube
// scene once it is covered (ART_PAUSE_MS there is a little longer). Under
// reduced motion the veil is a short fade.
const ART_VEIL_MS = 520
const ART_VEIL_REDUCED_MS = 160
// The pointer and «Volver» hide after this long still, so nothing sits on the art.
const IDLE_MS = 2000

// off: nothing shown · covering: the veil darkens while the world prepares
// behind it · on: the world alone · leaving: the veil darkens before the site
// comes back · revealing: the veil lifts over the site.
type Phase = 'off' | 'covering' | 'on' | 'leaving' | 'revealing'

type ArtModeLayerProps = {
  active: boolean
  worldId: WorldId | null
  fullName: string
  copy: InterfaceCopy
  onExit: () => void
}

// The fullscreen art mode of ADR 001 (spec 017): the face's world alone,
// signed with the owner's name. It dips through the site's dark to enter and
// to leave, so the cube scene and the art never show half-blended. Esc,
// another double-click or «Volver» leave; a single click does not.
export function ArtModeLayer({ active, worldId, fullName, copy, onExit }: ArtModeLayerProps) {
  const [phase, setPhase] = useState<Phase>('off')
  const [worldReady, setWorldReady] = useState(false)
  const [veilDone, setVeilDone] = useState(false)
  const [idle, setIdle] = useState(false)
  const [seenActive, setSeenActive] = useState(active)
  const layerRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const veilMs = useVeilMs()

  // The store turned the mode on or off (adjusted while rendering, as React
  // recommends for state that follows a prop). Off without the layer asking
  // (a resize to the stacked layout, a failed scene) drops the art at once.
  if (active !== seenActive) {
    setSeenActive(active)
    if (active && phase === 'off') {
      setPhase('covering')
      setWorldReady(false)
      setVeilDone(false)
      setIdle(false)
    } else if (!active && (phase === 'covering' || phase === 'on')) {
      setPhase('revealing')
    }
  }
  // Covered and the world compiled: lift the veil over the art.
  if (phase === 'covering' && worldReady && veilDone) setPhase('on')

  // Each phase that waits for the veil arms one timer.
  useEffect(() => {
    if (phase === 'covering') {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const timer = window.setTimeout(() => setVeilDone(true), veilMs)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'leaving') {
      // Once the veil is dark, hand the site back and lift the veil.
      const timer = window.setTimeout(() => {
        onExit()
        setPhase('revealing')
      }, veilMs)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'revealing') {
      const timer = window.setTimeout(() => {
        setPhase('off')
        restoreFocusRef.current?.focus({ preventScroll: true })
        restoreFocusRef.current = null
      }, veilMs)
      return () => window.clearTimeout(timer)
    }
  }, [phase, veilMs, onExit])

  const leave = useCallback(() => {
    setPhase((current) => (current === 'on' || current === 'covering' ? 'leaving' : current))
  }, [])

  useEffect(() => {
    if (phase !== 'on' && phase !== 'covering') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') leave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, leave])

  // Focus moves into the layer, so Tab reaches «Volver» and nothing behind it.
  // The pointer and the way back rest after a while still.
  useEffect(() => {
    if (phase === 'on') layerRef.current?.focus({ preventScroll: true })
  }, [phase])
  useEffect(() => {
    if (phase !== 'on' || idle) return
    const timer = window.setTimeout(() => setIdle(true), IDLE_MS)
    return () => window.clearTimeout(timer)
  }, [phase, idle])

  const handleWorldReady = useCallback(() => setWorldReady(true), [])

  if (phase === 'off') return null
  const showArt = (phase === 'covering' || phase === 'on' || phase === 'leaving') && worldId !== null
  const veilDark = phase === 'covering' || phase === 'leaving'

  return (
    <div
      ref={layerRef}
      className={cx('art-mode', idle && phase === 'on' && 'art-mode--idle')}
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label={copy.artLabel}
      tabIndex={-1}
      style={{ '--art-veil-ms': `${veilMs}ms` } as CSSProperties}
      onPointerMove={() => setIdle(false)}
      onDoubleClick={leave}
    >
      {showArt && (
        <div className="art-mode__canvas" aria-hidden="true">
          <ArtModeCanvas worldId={worldId} onReady={handleWorldReady} />
        </div>
      )}
      <p className="art-mode__signature" aria-hidden={phase !== 'on'}>
        {fullName}
      </p>
      <button className="art-mode__back focus-ring" type="button" onClick={leave} tabIndex={phase === 'on' ? 0 : -1}>
        <ArrowLeft aria-hidden size={15} strokeWidth={1.8} />
        <span>{copy.artBack}</span>
      </button>
      <div className={cx('art-mode__veil', veilDark && 'art-mode__veil--dark')} aria-hidden="true" />
    </div>
  )
}

function useVeilMs() {
  const [ms] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? ART_VEIL_REDUCED_MS : ART_VEIL_MS,
  )
  return ms
}
