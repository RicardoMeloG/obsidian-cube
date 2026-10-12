// Timeline of the first-visit intro (specs/009-cube-intro). Pure functions of
// the intro time `t`, in seconds from the first rendered frame of the scene, so
// the cube, the particles, the platform and the interface all read the same
// clock and the sequence can be unit-tested without WebGL.

export const INTRO = {
  fallStart: 0.35,
  land: 1.6,
  pulseDuration: 0.9,
  ringDuration: 0.9,
  firstTurn: 2.7,
  secondTurn: 10,
  turnDuration: 2.6,
  end: 5.4,
  fallHeight: 3.4,
  startYaw: (-28 * Math.PI) / 180,
  startPitch: (14 * Math.PI) / 180,
  // A full face: the next face comes to the front, holds, and the cube returns.
  turnYaw: -Math.PI / 2,
} as const

// Without an intro, a visitor who has not dragged the cube yet still gets one
// invitation turn shortly after load.
export const RETURN_TURN = 1.5

export type IntroPhase = 'hold' | 'fall' | 'landed' | 'done'

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

// CSS-style cubic-bezier(x1, y1, x2, y2) evaluated at x in [0, 1].
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const curve = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3
  const slope = (a: number, b: number, s: number) => 3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s * s

  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let s = x
    for (let i = 0; i < 6; i += 1) {
      const d = slope(x1, x2, s)
      if (Math.abs(d) < 1e-6) break
      s -= (curve(x1, x2, s) - x) / d
    }
    // Bisection fallback when Newton leaves the interval.
    if (s < 0 || s > 1 || Math.abs(curve(x1, x2, s) - x) > 1e-4) {
      let lo = 0
      let hi = 1
      s = x
      for (let i = 0; i < 30; i += 1) {
        if (curve(x1, x2, s) < x) lo = s
        else hi = s
        s = (lo + hi) / 2
      }
    }
    return curve(y1, y2, s)
  }
}

// Accelerates during the first part of the fall, then decelerates strongly into
// the rest height: heavy and guided, never a bounce.
const fallEase = cubicBezier(0.5, 0, 0.12, 1)
// The cube straightens mostly in the second half of the fall, so the turn is
// readable while it is in view, and reaches zero with zero speed on landing.
const turnEase = cubicBezier(0.55, 0, 0.35, 1)

export function introPhase(t: number): IntroPhase {
  if (t < INTRO.fallStart) return 'hold'
  if (t < INTRO.land) return 'fall'
  if (t < INTRO.end) return 'landed'
  return 'done'
}

export function fallProgress(t: number) {
  return fallEase(clamp01((t - INTRO.fallStart) / (INTRO.land - INTRO.fallStart)))
}

// Height above the cube's rest position.
export function fallOffset(t: number) {
  return INTRO.fallHeight * (1 - fallProgress(t))
}

// Yaw/pitch (radians) applied on top of the active face's orientation; zero on
// landing, so the cube arrives straight on its face.
export function fallTurn(t: number): { yaw: number; pitch: number } {
  const remaining = 1 - turnEase(clamp01((t - INTRO.fallStart) / (INTRO.land - INTRO.fallStart)))
  return { yaw: INTRO.startYaw * remaining, pitch: INTRO.startPitch * remaining }
}

// Landing flash, 0..1: quick attack, smooth decay.
export function landingPulse(t: number) {
  const age = t - INTRO.land
  if (age < 0 || age > INTRO.pulseDuration) return 0
  const attack = 0.08
  if (age < attack) return age / attack
  return (1 - (age - attack) / (INTRO.pulseDuration - attack)) ** 2
}

// Expanding ring on the platform: progress 0..1 while it is alive, else null.
export function ringProgress(t: number) {
  const age = t - INTRO.land
  if (age < 0 || age > INTRO.ringDuration) return null
  return age / INTRO.ringDuration
}

// Multiplier for the platform glow opacity: dim until the landing, flash, then 1.
export function platformGlowLevel(t: number) {
  if (t < INTRO.land) return 0.35
  return 1 + 0.18 * landingPulse(t)
}

// Multiplier for the beam opacity: brightens while the cube passes through it.
export function beamLevel(t: number) {
  if (t <= INTRO.fallStart || t >= INTRO.land) return 1
  const p = (t - INTRO.fallStart) / (INTRO.land - INTRO.fallStart)
  return 1 + 1.6 * Math.sin(Math.PI * p)
}

// Invitation turn: out to the next face, a short hold so it can be read, and
// back. Each leg starts and ends at zero speed.
const TURN_OUT = 0.4
const TURN_HOLD = 0.2
const legEase = (x: number) => (1 - Math.cos(Math.PI * clamp01(x))) / 2

export function turnAngle(t: number, starts: readonly number[]) {
  for (const start of starts) {
    const u = (t - start) / INTRO.turnDuration
    if (u > 0 && u < 1) {
      if (u < TURN_OUT) return INTRO.turnYaw * legEase(u / TURN_OUT)
      if (u < TURN_OUT + TURN_HOLD) return INTRO.turnYaw
      return INTRO.turnYaw * legEase((1 - u) / (1 - TURN_OUT - TURN_HOLD))
    }
  }
  return 0
}

// Development only: `?introAt=1.2` freezes the intro clock at that second, to
// review or tune any instant of the sequence.
export function readFreezeAt(search: string): number | null {
  const raw = new URLSearchParams(search).get('introAt')
  if (raw === null) return null
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : null
}

export const INTRO_SEEN_KEY = 'obsidian-cube:intro-seen'
export const CUBE_ENGAGED_KEY = 'obsidian-cube:cube-engaged'

export type IntroPlan = {
  play: boolean
  reducedMotion: boolean
  showHint: boolean
}

type StorageLike = Pick<Storage, 'getItem'>

function read(storage: StorageLike | null, key: string) {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

// `?intro=1` forces the intro, `?intro=0` disables it; otherwise it plays once
// per session. Reduced motion always wins.
export function planIntro(search: string, storage: StorageLike | null, reducedMotion: boolean): IntroPlan {
  const requested = new URLSearchParams(search).get('intro')
  const showHint = read(storage, CUBE_ENGAGED_KEY) === null

  if (reducedMotion || requested === '0') {
    return { play: false, reducedMotion, showHint }
  }
  const play = requested === '1' || read(storage, INTRO_SEEN_KEY) === null
  return { play, reducedMotion, showHint }
}
