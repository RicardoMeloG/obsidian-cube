import { describe, expect, it } from 'vitest'
import {
  INTRO,
  beamLevel,
  cubicBezier,
  fallOffset,
  fallTurn,
  introPhase,
  landingPulse,
  platformGlowLevel,
  ringProgress,
  turnAngle,
} from './introTimeline'

describe('intro timeline', () => {
  it('walks hold → fall → landed → done', () => {
    expect(introPhase(0)).toBe('hold')
    expect(introPhase(1)).toBe('fall')
    expect(introPhase(INTRO.land)).toBe('landed')
    expect(introPhase(INTRO.end)).toBe('done')
  })

  it('starts out of view and lands exactly at rest, straight on its face', () => {
    expect(fallOffset(0)).toBeCloseTo(INTRO.fallHeight)
    expect(fallOffset(INTRO.land)).toBe(0)
    expect(fallTurn(INTRO.land).yaw).toBeCloseTo(0)
    expect(fallTurn(INTRO.land).pitch).toBeCloseTo(0)
    expect(fallTurn(0).yaw).toBeCloseTo(INTRO.startYaw)
  })

  it('falls monotonically, without overshooting the rest height (no bounce)', () => {
    let previous = Infinity
    for (let t = 0; t <= INTRO.land + 0.5; t += 0.01) {
      const offset = fallOffset(t)
      expect(offset).toBeLessThanOrEqual(previous + 1e-9)
      expect(offset).toBeGreaterThanOrEqual(0)
      previous = offset
    }
  })

  it('evaluates cubic-bezier like CSS at the endpoints and midpoint of linear', () => {
    const linear = cubicBezier(0.25, 0.25, 0.75, 0.75)
    expect(linear(0)).toBe(0)
    expect(linear(1)).toBe(1)
    expect(linear(0.5)).toBeCloseTo(0.5, 3)
  })

  it('pulses the landing only around the landing', () => {
    expect(landingPulse(INTRO.land - 0.1)).toBe(0)
    expect(landingPulse(INTRO.land + 0.08)).toBeCloseTo(1)
    expect(landingPulse(INTRO.land + INTRO.pulseDuration + 0.01)).toBe(0)
    expect(ringProgress(INTRO.land - 0.01)).toBeNull()
    expect(ringProgress(INTRO.land + INTRO.ringDuration / 2)).toBeCloseTo(0.5)
    expect(platformGlowLevel(0)).toBeLessThan(1)
    expect(platformGlowLevel(INTRO.end)).toBe(1)
    expect(beamLevel(0)).toBe(1)
    expect(beamLevel((INTRO.fallStart + INTRO.land) / 2)).toBeGreaterThan(1)
  })

  it('turns a full face out, holds it, and comes back, zero outside the window', () => {
    const starts = [INTRO.firstTurn]
    expect(turnAngle(INTRO.firstTurn - 0.1, starts)).toBe(0)
    expect(turnAngle(INTRO.firstTurn + INTRO.turnDuration / 2, starts)).toBeCloseTo(INTRO.turnYaw)
    expect(Math.abs(INTRO.turnYaw)).toBeCloseTo(Math.PI / 2)
    expect(turnAngle(INTRO.firstTurn + 0.01, starts)).toBeCloseTo(0, 2)
    expect(turnAngle(INTRO.firstTurn + INTRO.turnDuration - 0.01, starts)).toBeCloseTo(0, 2)
    expect(turnAngle(INTRO.firstTurn + INTRO.turnDuration + 0.1, starts)).toBe(0)
  })
})
