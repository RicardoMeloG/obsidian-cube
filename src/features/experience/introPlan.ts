// When the first-visit intro plays, whether the rotate hint shows
// (specs/009-cube-intro) and whether the cube still invites its first click. Experience logic, not scene logic: the scene only
// receives the result. Pure, so it is unit-tested without a browser.

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
// Kept across visits (local storage): the nudge shows once per visitor.
export const NUDGE_SEEN_KEY = 'obsidian-cube:nudge-seen'

export type IntroPlan = {
  play: boolean
  reducedMotion: boolean
  showHint: boolean
  showNudge: boolean
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
// per session. Reduced motion always wins. `?nudge=1` shows the nudge again.
export function planIntro(search: string, storage: StorageLike | null, reducedMotion: boolean, lasting: StorageLike | null = null): IntroPlan {
  const params = new URLSearchParams(search)
  const requested = params.get('intro')
  const showHint = read(storage, CUBE_ENGAGED_KEY) === null
  const showNudge = params.get('nudge') === '1' || read(lasting, NUDGE_SEEN_KEY) === null

  if (reducedMotion || requested === '0') {
    return { play: false, reducedMotion, showHint, showNudge }
  }
  const play = requested === '1' || read(storage, INTRO_SEEN_KEY) === null
  return { play, reducedMotion, showHint, showNudge }
}

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function localStore(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// The plan for this page load, from the URL, the session and the motion setting.
export function readIntroPlan(): IntroPlan {
  if (typeof window === 'undefined') {
    return { play: false, reducedMotion: false, showHint: false, showNudge: false }
  }
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  return planIntro(window.location.search, sessionStore(), reducedMotion, localStore())
}

// Records a session flag (intro seen, cube dragged). Blocked storage only means
// the intro may replay, which is harmless.
export function rememberInSession(key: string) {
  try {
    sessionStore()?.setItem(key, '1')
  } catch {
    // ignore
  }
}

// Records that the nudge was shown, for good. Blocked storage only means it may
// show again on a later visit.
export function rememberForGood(key: string) {
  try {
    localStore()?.setItem(key, '1')
  } catch {
    // ignore
  }
}
