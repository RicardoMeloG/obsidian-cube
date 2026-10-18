// @vitest-environment node
import { UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthController } from './auth.controller'
import { AuthGuard } from './auth.guard'
import type { AuthService } from './auth.service'
import { BYPASS_USER } from './devBypass'

// The guard and the controller themselves, not only the helper they call
// (audit-4 F-2): a refactor that moves the bypass must break a test.
const local = { headers: { host: '127.0.0.1:5182' }, socket: { remoteAddress: '127.0.0.1' } }
const foreign = { ...local, headers: { ...local.headers, origin: 'https://evil.example' } }
const full = { session: { user: { username: 'owner', stage: 'full' as const } } }
const contextOf = (request: object) => ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext

const guard = new AuthGuard()
const controller = new AuthController({} as AuthService)

afterEach(() => vi.unstubAllEnvs())

describe('AuthGuard and /auth/me', () => {
  it('ask for a full session while the bypass is off', () => {
    vi.stubEnv('ADMIN_AUTH', 'on')
    expect(() => guard.canActivate(contextOf(local))).toThrow(UnauthorizedException)
    expect(() => guard.canActivate(contextOf({ ...local, session: { user: { username: 'owner', stage: 'password' } } }))).toThrow(UnauthorizedException)
    expect(guard.canActivate(contextOf({ ...local, ...full }))).toBe(true)
    expect(controller.me(local)).toMatchObject({ authenticated: false })
    expect(controller.me({ ...local, ...full })).toEqual({ authenticated: true, stage: 'full', username: 'owner' })
  })

  it('with the bypass, let through a local request with no session, and nothing else', () => {
    vi.stubEnv('ADMIN_AUTH', 'off')
    vi.stubEnv('APP_ENV', 'development')
    expect(guard.canActivate(contextOf(local))).toBe(true)
    expect(controller.me(local)).toEqual({ authenticated: true, stage: 'full', username: BYPASS_USER, bypass: true })
    expect(() => guard.canActivate(contextOf(foreign))).toThrow(UnauthorizedException)
    expect(controller.me(foreign)).toMatchObject({ authenticated: false })
    expect(() => guard.canActivate(contextOf({ ...local, socket: { remoteAddress: '192.168.1.20' } }))).toThrow(UnauthorizedException)
  })
})
