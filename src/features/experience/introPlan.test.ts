import { describe, expect, it } from 'vitest'
import { CUBE_ENGAGED_KEY, INTRO_SEEN_KEY, NUDGE_SEEN_KEY, planIntro } from './introPlan'

const storage = (entries: Record<string, string> = {}) => ({ getItem: (key: string) => entries[key] ?? null })

describe('planIntro', () => {
  it('plays on the first load of a session and shows the hint and the nudge', () => {
    expect(planIntro('', storage(), false, storage())).toEqual({ play: true, reducedMotion: false, showHint: true, showNudge: true })
  })

  it('does not replay in the same session', () => {
    expect(planIntro('', storage({ [INTRO_SEEN_KEY]: '1' }), false).play).toBe(false)
  })

  it('obeys ?intro=1 and ?intro=0', () => {
    expect(planIntro('?intro=1', storage({ [INTRO_SEEN_KEY]: '1' }), false).play).toBe(true)
    expect(planIntro('?intro=0', storage(), false).play).toBe(false)
  })

  it('never plays with reduced motion, even when forced', () => {
    expect(planIntro('?intro=1', storage(), true)).toEqual({ play: false, reducedMotion: true, showHint: true, showNudge: true })
  })

  it('hides the hint once the cube has been dragged in this session', () => {
    expect(planIntro('', storage({ [CUBE_ENGAGED_KEY]: '1' }), false).showHint).toBe(false)
  })

  it('shows the nudge once per visitor, again only with ?nudge=1', () => {
    const seen = storage({ [NUDGE_SEEN_KEY]: '1' })
    expect(planIntro('', storage(), false, seen).showNudge).toBe(false)
    expect(planIntro('?intro=0', storage(), false, seen).showNudge).toBe(false)
    expect(planIntro('?nudge=1', storage(), false, seen).showNudge).toBe(true)
  })

  it('treats unreadable storage as empty', () => {
    const throwing = { getItem: () => { throw new Error('blocked') } }
    expect(planIntro('', throwing, false).play).toBe(true)
    expect(planIntro('', throwing, false, throwing).showNudge).toBe(true)
  })
})
