import { createContext, useContext, useSyncExternalStore } from 'react'
import type { CubeSectionDetail, CubeSectionId } from '@/kernel/faces'

// State of the experience and the events that change it (ADR 006, spec 010
// AD-04). The scene and the DOM never talk to each other: both read this state
// and dispatch these events. Per-frame values (pointer, drag, the intro clock)
// stay inside the scene.

export type PanelTransition = 'idle' | 'exiting' | 'entering'
// pending: interface hidden while the cube falls · reveal: staged fade-in
// after the landing · done: no intro styling at all.
export type IntroStage = 'pending' | 'reveal' | 'done'
export type CursorMode = 'default' | 'grab' | 'grabbing'

export type ExperienceState = {
  // The face the cube shows; `displayedFace` is the one the rails show, which
  // follows it after the exit half of the transition.
  activeFace: CubeSectionId
  displayedFace: CubeSectionId
  transition: PanelTransition
  // A face asked for (strip, link) that the scene is turning towards.
  requestedFace: CubeSectionId | null
  // Whether a scene is mounted to turn the cube; without one, faces change at once.
  sceneReady: boolean
  intro: IntroStage
  introSkipped: boolean
  hintVisible: boolean
  detail: { open: boolean; focused: CubeSectionDetail | null }
  cursor: CursorMode
}

export type ExperienceEvent =
  | { type: 'sceneMounted' }
  | { type: 'sceneFailed' }
  | { type: 'faceRequested'; face: CubeSectionId }
  | { type: 'faceEntered'; face: CubeSectionId }
  | { type: 'panelsSwapped' }
  | { type: 'transitionFinished' }
  | { type: 'introLanded' }
  | { type: 'introSettled' }
  | { type: 'introSkipped' }
  | { type: 'visitorEngaged' }
  | { type: 'detailOpened'; detail: CubeSectionDetail | null }
  | { type: 'detailClosed' }
  | { type: 'cursorChanged'; cursor: CursorMode }

export function initialExperience(options: { face: CubeSectionId; introPlays: boolean; hintVisible: boolean }): ExperienceState {
  return {
    activeFace: options.face,
    displayedFace: options.face,
    transition: 'idle',
    requestedFace: null,
    sceneReady: false,
    intro: options.introPlays ? 'pending' : 'done',
    introSkipped: false,
    hintVisible: options.hintVisible,
    detail: { open: false, focused: null },
    cursor: 'default',
  }
}

const CLOSED_DETAIL: ExperienceState['detail'] = { open: false, focused: null }

function enterFace(state: ExperienceState, face: CubeSectionId): ExperienceState {
  // Back on the face the rails already show (a quick change and return):
  // cancel the transition instead of leaving the rails faded out.
  const transition = face === state.displayedFace ? 'idle' : 'exiting'
  return { ...state, activeFace: face, requestedFace: null, transition, detail: CLOSED_DETAIL }
}

export function experienceReducer(state: ExperienceState, event: ExperienceEvent): ExperienceState {
  switch (event.type) {
    case 'sceneMounted':
      return { ...state, sceneReady: true }
    case 'sceneFailed':
      // The still image replaces the scene: nothing will land, so the
      // interface shows and faces change without turning.
      return { ...state, sceneReady: false, requestedFace: null, intro: 'done' }
    case 'faceRequested':
      if (event.face === state.activeFace) return state
      // The scene turns the cube and reports the face once it lands; without a
      // scene the face changes at once, so navigation never depends on the 3D.
      return state.sceneReady
        ? { ...state, requestedFace: event.face, detail: CLOSED_DETAIL }
        : enterFace(state, event.face)
    case 'faceEntered':
      return enterFace(state, event.face)
    case 'panelsSwapped':
      return state.transition === 'exiting' ? { ...state, displayedFace: state.activeFace, transition: 'entering' } : state
    case 'transitionFinished':
      return state.transition === 'entering' ? { ...state, transition: 'idle' } : state
    case 'introLanded':
      return state.intro === 'pending' ? { ...state, intro: 'reveal' } : state
    case 'introSettled':
      return state.intro === 'reveal' ? { ...state, intro: 'done' } : state
    case 'introSkipped':
      return state.intro === 'done' ? state : { ...state, intro: 'done', introSkipped: true }
    case 'visitorEngaged':
      return state.hintVisible ? { ...state, hintVisible: false } : state
    case 'detailOpened':
      return { ...state, detail: { open: true, focused: event.detail } }
    case 'detailClosed':
      return state.detail.open ? { ...state, detail: CLOSED_DETAIL } : state
    case 'cursorChanged':
      return state.cursor === event.cursor ? state : { ...state, cursor: event.cursor }
  }
}

export type ExperienceStore = {
  getState: () => ExperienceState
  dispatch: (event: ExperienceEvent) => void
  subscribe: (listener: () => void) => () => void
}

export function createExperienceStore(initial: ExperienceState): ExperienceStore {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    dispatch(event) {
      const next = experienceReducer(state, event)
      if (next === state) return
      state = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const ExperienceContext = createContext<ExperienceStore | null>(null)

export const ExperienceProvider = ExperienceContext.Provider

export function useExperienceStore(): ExperienceStore {
  const store = useContext(ExperienceContext)
  if (!store) throw new Error('useExperienceStore needs an ExperienceProvider above it.')
  return store
}

// Subscribes a component to one slice of the state; it re-renders only when
// that slice changes. The selector must return a stable value for an
// unchanged state (a field, not a new object).
export function useExperience<Slice>(selector: (state: ExperienceState) => Slice): Slice {
  const store = useExperienceStore()
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}
