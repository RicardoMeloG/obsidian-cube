import { Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import type { SessionUser } from './auth.service'

// The part of an express-session request this controller touches.
type SessionRequest = {
  session?: { user?: SessionUser; destroy?: (callback: () => void) => void }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  me(@Req() req: SessionRequest) {
    const user = req.session?.user
    return {
      authenticated: user?.stage === 'full',
      stage: user?.stage ?? null,
      username: user?.username ?? null,
    }
  }

  @Post('login')
  async login(@Req() req: SessionRequest, @Body() body: { username?: string; password?: string }) {
    const { user, mfaRequired, enrollRequired } = await this.auth.login(body.username ?? '', body.password ?? '')
    if (req.session) req.session.user = user
    return { ok: true, mfaRequired, enrollRequired }
  }

  @Post('mfa')
  async mfa(@Req() req: SessionRequest, @Body() body: { token?: string }) {
    const user = this.requirePartial(req)
    await this.auth.verifyMfa(user.username, body.token ?? '')
    if (req.session) req.session.user = { username: user.username, stage: 'full' }
    return { ok: true }
  }

  @Post('enroll/start')
  enrollStart(@Req() req: SessionRequest) {
    const user = this.requirePartial(req)
    return this.auth.startEnrollment(user.username)
  }

  @Post('enroll/verify')
  async enrollVerify(@Req() req: SessionRequest, @Body() body: { token?: string }) {
    const user = this.requirePartial(req)
    await this.auth.verifyEnrollment(user.username, body.token ?? '')
    if (req.session) req.session.user = { username: user.username, stage: 'full' }
    return { ok: true }
  }

  @Post('logout')
  logout(@Req() req: SessionRequest) {
    req.session?.destroy?.(() => undefined)
    return { ok: true }
  }

  // The second-factor / enrollment steps require a password-stage session.
  private requirePartial(req: SessionRequest) {
    const user = req.session?.user
    if (!user || user.stage !== 'password') {
      throw new UnauthorizedException('Primero inicia sesión con usuario y contraseña.')
    }
    return user
  }
}
