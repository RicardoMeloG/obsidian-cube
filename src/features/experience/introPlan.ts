// When the first-visit intro plays and whether the rotate hint shows
// (specs/009-cube-intro). Experience logic, not scene logic: the scene only
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

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

// The plan for this page load, from the URL, the session and the motion setting.
export function readIntroPlan(): IntroPlan {
  if (typeof window === 'undefined') {
    return { play: false, reducedMotion: false, showHint: false }
  }
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  return planIntro(window.location.search, sessionStore(), reducedMotion)
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
