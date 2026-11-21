// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createBrakes, forwardedCount, PER_IP_LIMIT, PER_IP_WINDOW_MS, PER_SECOND, viewerIp } from '../../infra/lambda/match-log/brakes.mjs'

// The match-log receiver's write brakes (spec 016, P-1; owner, 2026-11-21).
describe('match log brakes', () => {
  it('reads the viewer IP CloudFront appended, not what the client sent', () => {
    expect(viewerIp({ 'x-forwarded-for': '203.0.113.9' }, '130.176.1.1')).toBe('203.0.113.9')
    // A forged entry on the left, the viewer appended by CloudFront, then the edge.
    expect(viewerIp({ 'X-Forwarded-For': '1.2.3.4, 203.0.113.9, 130.176.1.1' }, '130.176.1.1')).toBe('203.0.113.9')
    expect(viewerIp({}, '130.176.1.1')).toBeNull()
    expect(viewerIp({ 'x-forwarded-for': '130.176.1.1' }, '130.176.1.1')).toBeNull()
  })

  it('lets one address store PER_IP_LIMIT logs in the window, then refuses until the oldest ages out', () => {
    const brakes = createBrakes()
    let now = 1_000_000
    for (let i = 0; i < PER_IP_LIMIT; i += 1) {
      expect(brakes.take('203.0.113.9', now)).toBeNull()
      now += 2000 // apart, so the per-second limit does not interfere
    }
    const refused = brakes.take('203.0.113.9', now)
    expect(refused?.status).toBe(429)
    expect(refused?.retryAfter).toBeGreaterThan(0)
    expect(brakes.take('198.51.100.7', now)).toBeNull() // another address is unaffected
    expect(brakes.take('203.0.113.9', 1_000_000 + PER_IP_WINDOW_MS)).toBeNull()
  })

  it('caps all writes at PER_SECOND a second, whatever the addresses', () => {
    const brakes = createBrakes()
    const now = 5_000_000
    for (let i = 0; i < PER_SECOND; i += 1) expect(brakes.take(`198.51.100.${i}`, now)).toBeNull()
    expect(brakes.take('198.51.100.200', now)?.status).toBe(429)
    expect(brakes.take(null, now)?.status).toBe(429) // no IP still counts in the total
    expect(brakes.take('198.51.100.200', now + 1000)).toBeNull()
  })

  it('a total refusal does not count against the address', () => {
    const brakes = createBrakes({ perSecond: 1, perIpLimit: 1 })
    expect(brakes.take('a', 0)).toBeNull()
    expect(brakes.take('b', 10)?.reason).toMatch(/too many writes/) // refused by the total
    expect(brakes.take('b', 1000)).toBeNull() // so b still has its one write
    expect(brakes.take('b', 2000)?.reason).toMatch(/this address/) // and now it is spent
  })

  it('a per-address refusal does not use a slot of the total', () => {
    const brakes = createBrakes({ perSecond: 2, perIpLimit: 1 })
    expect(brakes.take('a', 0)).toBeNull()
    expect(brakes.take('a', 10)?.reason).toMatch(/this address/)
    expect(brakes.take('b', 20)).toBeNull() // the second slot of the second is still free
  })

  it('the map of addresses stays bounded and forgets the least recent first', () => {
    const brakes = createBrakes({ perSecond: 1_000_000, perIpLimit: 1, maxTrackedIps: 3 })
    brakes.take('first', 0)
    brakes.take('second', 1)
    brakes.take('third', 2)
    brakes.take('second', 3) // refused, but still known
    brakes.take('fourth', 4) // pushes out the least recently stored: first
    expect(brakes.trackedIps()).toBe(3)
    expect(brakes.take('first', 5)).toBeNull() // forgotten, so allowed again
    expect(brakes.take('fourth', 6)?.reason).toMatch(/this address/) // remembered
  })

  it('counts the X-Forwarded-For entries for the log, without the addresses', () => {
    expect(forwardedCount({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9 ,130.176.1.1' })).toBe(3)
    expect(forwardedCount({})).toBe(0)
  })
})
