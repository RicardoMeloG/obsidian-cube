import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { FaceId } from '@/kernel/faces'
import type { WorldId } from '@/kernel/worlds'
import { WORLD_LABELS } from '@/kernel/worlds'
import type { InterfaceCopy } from '@/features/content/copy'
import { ArtModeCanvas } from '@/features/scene/ArtModeCanvas'
import { cx } from '@/ui/cx'
import './artMode.css'

// How long the veil takes to cover or uncover. SceneLayer pauses the cube
// scene once it is covered (ART_PAUSE_MS there is a little longer). Under
// reduced motion the veil is a short fade.
const ART_VEIL_MS = 520
const ART_VEIL_REDUCED_MS = 160
// The pointer and the controls hide after this long still, so nothing sits on the art.
const IDLE_MS = 2000

// off: nothing shown · covering: the veil darkens while a world prepares
// behind it (on entering, and between worlds) · on: the world alone ·
// leaving: the veil darkens before the site comes back · revealing: the veil
// lifts over the site.
type Phase = 'off' | 'covering' | 'on' | 'leaving' | 'revealing'

export type ArtWorld = { face: FaceId; worldId: WorldId }

type ArtModeLayerProps = {
  active: boolean
  // The faces that have a world, in the cube's order: the gallery.
  worlds: ArtWorld[]
  // The face the visitor opened the mode on.
  face: FaceId
  fullName: string
  copy: InterfaceCopy
  // Leaves the mode on the face of the last world shown.
  onExit: (face: FaceId) => void
}

// The fullscreen art mode of ADR 001 (spec 017): a face's world alone, signed
// with the owner's name, with the worlds' own names (WORLD_LABELS) in a menu
// to move between them, as in the dev showcase. It dips through the site's
// dark to enter, to change world and to leave, so two scenes never show
// half-blended. Esc, another double-click or «Volver» leave; a single click
// does not.
export function ArtModeLayer({ active, worlds, face, fullName, copy, onExit }: ArtModeLayerProps) {
  const [phase, setPhase] = useState<Phase>('off')
  const [viewFace, setViewFace] = useState<FaceId>(face)
  const [pendingFace, setPendingFace] = useState<FaceId | null>(null)
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
      setViewFace(face)
      setPendingFace(null)
      setPhase('covering')
      setWorldReady(false)
      setVeilDone(false)
      setIdle(false)
    } else if (!active && (phase === 'covering' || phase === 'on')) {
      setPhase('revealing')
    }
  }
  // Covered and the world compiled: lift the veil over the art.
  if (phase === 'covering' && worldReady && veilDone && pendingFace === null) setPhase('on')

  // Each phase that waits for the veil arms one timer.
  useEffect(() => {
    if (phase === 'covering' && !veilDone) {
      if (!restoreFocusRef.current && document.activeElement instanceof HTMLElement && !layerRef.current?.contains(document.activeElement)) {
        restoreFocusRef.current = document.activeElement
      }
      const timer = window.setTimeout(() => {
        // Between worlds, the next one replaces the current under the dark veil.
        if (pendingFace) {
          setViewFace(pendingFace)
          setPendingFace(null)
          setWorldReady(false)
        }
        setVeilDone(true)
      }, veilMs)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'leaving') {
      // Once the veil is dark, hand the site back and lift the veil.
      const timer = window.setTimeout(() => {
        onExit(viewFace)
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
  }, [phase, veilDone, pendingFace, viewFace, veilMs, onExit])

  const leave = useCallback(() => {
    setPhase((current) => (current === 'on' || current === 'covering' ? 'leaving' : current))
  }, [])

  const show = useCallback(
    (next: FaceId) => {
      if (phase !== 'on' || next === viewFace) return
      setPendingFace(next)
      setVeilDone(false)
      setPhase('covering')
    },
    [phase, viewFace],
  )

  useEffect(() => {
    if (phase !== 'on' && phase !== 'covering') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') leave()
      if (phase !== 'on' || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return
      const index = worlds.findIndex((world) => world.face === viewFace)
      if (index === -1 || worlds.length < 2) return
      const step = event.key === 'ArrowRight' ? 1 : -1
      show(worlds[(index + step + worlds.length) % worlds.length].face)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, leave, show, worlds, viewFace])

  // Focus moves into the layer once, so Tab reaches the controls and nothing
  // behind them. The pointer and the controls rest after a while still.
  useEffect(() => {
    if (phase === 'on' && !layerRef.current?.contains(document.activeElement)) layerRef.current?.focus({ preventScroll: true })
  }, [phase])
  useEffect(() => {
    if (phase !== 'on' || idle) return
    const timer = window.setTimeout(() => setIdle(true), IDLE_MS)
    return () => window.clearTimeout(timer)
  }, [phase, idle])

  const handleWorldReady = useCallback(() => setWorldReady(true), [])

  if (phase === 'off') return null
  const current = worlds.find((world) => world.face === viewFace) ?? null
  const showArt = (phase === 'covering' || phase === 'on' || phase === 'leaving') && current !== null
  const veilDark = phase === 'covering' || phase === 'leaving'
  const controlsTab = phase === 'on' ? 0 : -1

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
      onDoubleClick={(event) => {
        if (!(event.target instanceof Element && event.target.closest('button, nav'))) leave()
      }}
    >
      {showArt && (
        <div className="art-mode__canvas" aria-hidden="true">
          <ArtModeCanvas key={current.worldId} worldId={current.worldId} onReady={handleWorldReady} />
        </div>
      )}

      <header className="art-mode__chrome">
        <button className="art-mode__back focus-ring" type="button" onClick={leave} tabIndex={controlsTab}>
          <ArrowLeft aria-hidden size={15} strokeWidth={1.8} />
          <span>{copy.artBack}</span>
        </button>
        {current && (
          <p className="art-mode__title" aria-live="polite">
            {WORLD_LABELS[current.worldId]}
          </p>
        )}
        {worlds.length > 1 && (
          <nav className="art-mode__worlds" aria-label={copy.artWorlds}>
            {worlds.map((world) => (
              <button
                key={world.face}
                type="button"
                className="focus-ring"
                aria-current={world.face === viewFace ? 'true' : undefined}
                tabIndex={controlsTab}
                onClick={() => show(world.face)}
              >
                {WORLD_LABELS[world.worldId]}
              </button>
            ))}
          </nav>
        )}
      </header>

      <p className="art-mode__signature" aria-hidden={phase !== 'on'}>
        {fullName}
      </p>
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
