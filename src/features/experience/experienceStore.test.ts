import { describe, expect, it } from 'vitest'
import { createExperienceStore, experienceReducer, initialExperience } from './experienceStore'
import type { ExperienceEvent, ExperienceState } from './experienceStore'

const start = (overrides: Partial<ExperienceState> = {}) => ({
  ...initialExperience({ face: 'agentic', introPlays: false, hintVisible: true }),
  ...overrides,
})
const run = (state: ExperienceState, ...events: ExperienceEvent[]) => events.reduce(experienceReducer, state)
const detail = { title: 'T', summary: 'S' }

describe('face changes', () => {
  it('turn the cube when a scene is mounted, and change the face when it lands', () => {
    const requested = run(start({ sceneReady: true }), { type: 'faceRequested', face: 'research' })
    expect(requested.requestedFace).toBe('research')
    expect(requested.activeFace).toBe('agentic')

    const landed = run(requested, { type: 'faceEntered', face: 'research' })
    expect(landed).toMatchObject({ activeFace: 'research', displayedFace: 'agentic', transition: 'exiting', requestedFace: null })
  })

  it('change the face at once without a scene (no WebGL, or the scene failed)', () => {
    const state = run(start(), { type: 'faceRequested', face: 'systems' })
    expect(state).toMatchObject({ activeFace: 'systems', transition: 'exiting' })
  })

  it('swap the rails half way and settle', () => {
    const state = run(start(), { type: 'faceEntered', face: 'systems' }, { type: 'panelsSwapped' })
    expect(state).toMatchObject({ displayedFace: 'systems', transition: 'entering' })
    expect(run(state, { type: 'transitionFinished' }).transition).toBe('idle')
  })

  it('cancel the transition when the visitor returns to the face the rails still show', () => {
    const state = run(start(), { type: 'faceEntered', face: 'systems' }, { type: 'faceEntered', face: 'agentic' })
    expect(state).toMatchObject({ activeFace: 'agentic', displayedFace: 'agentic', transition: 'idle' })
  })

  it('close the detail dialog', () => {
    const open = run(start(), { type: 'detailOpened', detail })
    expect(run(open, { type: 'faceRequested', face: 'contact' }).detail.open).toBe(false)
  })

  it('ignore a request for the face already shown', () => {
    const state = start()
    expect(run(state, { type: 'faceRequested', face: 'agentic' })).toBe(state)
  })
})

describe('intro', () => {
  const playing = () => start({ intro: 'pending', sceneReady: true })

  it('reveals the interface after the landing, then settles', () => {
    const revealed = run(playing(), { type: 'introLanded' })
    expect(revealed.intro).toBe('reveal')
    expect(run(revealed, { type: 'introSettled' }).intro).toBe('done')
  })

  it('ends at once and asks the scene to skip when the visitor acts', () => {
    expect(run(playing(), { type: 'introSkipped' })).toMatchObject({ intro: 'done', introSkipped: true })
  })

  it('does not count a skip after the intro already ended', () => {
    expect(run(start(), { type: 'introSkipped' }).introSkipped).toBe(false)
  })

  it('shows the interface and stops turning when the scene fails', () => {
    const state = run(playing(), { type: 'faceRequested', face: 'products' }, { type: 'sceneFailed' })
    expect(state).toMatchObject({ intro: 'done', sceneReady: false, requestedFace: null })
  })
})

describe('store', () => {
  it('notifies only on a real change', () => {
    const store = createExperienceStore(start())
    let calls = 0
    store.subscribe(() => (calls += 1))
    store.dispatch({ type: 'visitorEngaged' })
    store.dispatch({ type: 'visitorEngaged' })
    expect(calls).toBe(1)
    expect(store.getState().hintVisible).toBe(false)
  })
})
