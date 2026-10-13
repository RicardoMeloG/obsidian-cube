import { useSyncExternalStore } from 'react'

// Layout modes, one source for CSS and JavaScript (ADR 006, spec 010 AD-06).
// The CSS repeats these exact strings in its @media rules; layoutModes.test.ts
// fails if they drift. Components never compare widths themselves.
//
//   stacked        cube on top, rails below, the page scrolls
//   narrow         phone-sized stacked layout
//   desktop        cube in the centre, rails left and right, strip at the bottom
//   desktop-short  desktop on a short screen: the rails compact
//   stacked-wide   stacked on a wide but squarish screen (tablet landscape)
//   tight          any layout up to 1100px wide: narrower rail columns
//   phone          phones up to 680px: the face strip takes two rows
//   phone-small    phones up to 389px: research concepts in one column
// tokens.css turns each into a Tailwind variant of the same name.
export const LAYOUT_QUERIES = {
  stacked: '(max-width: 900px), (max-aspect-ratio: 4 / 3)',
  stackedWide: '(min-width: 901px) and (max-aspect-ratio: 4 / 3)',
  narrow: '(max-width: 720px)',
  tight: '(max-width: 1100px)',
  phone: '(max-width: 680px)',
  phoneSmall: '(max-width: 389px)',
  desktop: '(not ((max-width: 900px) or (max-aspect-ratio: 4 / 3)))',
  desktopShort: '(not ((max-width: 900px) or (max-aspect-ratio: 4 / 3))) and (max-height: 900px)',
} as const

export type LayoutMode = 'stacked' | 'desktop' | 'desktop-short'

export type LayoutState = {
  mode: LayoutMode
  stacked: boolean
  narrow: boolean
}

function matches(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia(query).matches
}

function readLayout(): LayoutState {
  const stacked = matches(LAYOUT_QUERIES.stacked)
  const mode: LayoutMode = stacked ? 'stacked' : matches(LAYOUT_QUERIES.desktopShort) ? 'desktop-short' : 'desktop'
  return { mode, stacked, narrow: matches(LAYOUT_QUERIES.narrow) }
}

// useSyncExternalStore needs a stable snapshot: the cached state is replaced
// only when a query actually changes.
let snapshot: LayoutState | undefined

function getSnapshot(): LayoutState {
  const next = readLayout()
  if (!snapshot || snapshot.mode !== next.mode || snapshot.narrow !== next.narrow) snapshot = next
  return snapshot
}

const SERVER_SNAPSHOT: LayoutState = { mode: 'desktop', stacked: false, narrow: false }

function subscribe(onChange: () => void): () => void {
  const lists = Object.values(LAYOUT_QUERIES).map((query) => window.matchMedia(query))
  for (const list of lists) list.addEventListener('change', onChange)
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange)
  }
}

export function useLayoutMode(): LayoutState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT)
}
