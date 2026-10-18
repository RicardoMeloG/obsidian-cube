import { describe, expect, it } from 'vitest'
import { adminAuthOff, bypasses, isLocalRequest } from './devBypass'

const local = { headers: { host: '127.0.0.1:5182' }, socket: { remoteAddress: '127.0.0.1' } }

describe('development login bypass', () => {
  it('is off unless ADMIN_AUTH=off is set', () => {
    expect(adminAuthOff({})).toBe(false)
    expect(adminAuthOff({ ADMIN_AUTH: 'on' })).toBe(false)
    expect(adminAuthOff({ ADMIN_AUTH: 'off' })).toBe(true)
    expect(adminAuthOff({ ADMIN_AUTH: 'off', APP_ENV: 'development' })).toBe(true)
  })

  it('stops the server with production, or with a value it does not know', () => {
    expect(() => adminAuthOff({ ADMIN_AUTH: 'off', APP_ENV: 'production' })).toThrow()
    expect(() => adminAuthOff({ ADMIN_AUTH: 'false' })).toThrow()
  })

  it('lets through only requests made on this machine to the admin itself', () => {
    expect(isLocalRequest(local)).toBe(true)
    expect(isLocalRequest({ ...local, headers: { host: 'localhost:5182', origin: 'http://localhost:5182' } })).toBe(true)
    expect(isLocalRequest({ ...local, socket: { remoteAddress: '::1' } })).toBe(true)
    // Another machine, a DNS name pointed at 127.0.0.1, a page from another site.
    expect(isLocalRequest({ ...local, socket: { remoteAddress: '192.168.1.20' } })).toBe(false)
    expect(isLocalRequest({ ...local, headers: { host: 'evil.example:5182' } })).toBe(false)
    expect(isLocalRequest({ ...local, headers: { host: '127.0.0.1:5182', origin: 'https://evil.example' } })).toBe(false)
    expect(isLocalRequest({ ...local, headers: { host: '127.0.0.1:5182', origin: 'http://localhost:5180' } })).toBe(false)
  })

  it('needs both: the flag and a local request', () => {
    expect(bypasses(local, {})).toBe(false)
    expect(bypasses(local, { ADMIN_AUTH: 'off' })).toBe(true)
    expect(bypasses({ ...local, socket: { remoteAddress: '10.0.0.2' } }, { ADMIN_AUTH: 'off' })).toBe(false)
  })
})
