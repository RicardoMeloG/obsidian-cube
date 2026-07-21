import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import bcrypt from 'bcryptjs'
import * as OTPAuth from 'otpauth'
import * as QRCode from 'qrcode'
import { AuthRepository } from './auth.repository'

const ISSUER = 'Obsidian Cube Admin'

export type SessionUser = { username: string; stage: 'password' | 'full' }

function totpFor(username: string, base32Secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  })
}

@Injectable()
export class AuthService {
  constructor(private readonly users: AuthRepository) {}

  // Verify credentials → partial session. Second factor (verify or enroll) next.
  async login(
    username: string,
    password: string,
  ): Promise<{ user: SessionUser; mfaRequired: boolean; enrollRequired: boolean }> {
    this.requireDb()
    const user = await this.users.getUser(username)
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas.')
    }
    return {
      user: { username: user.username, stage: 'password' },
      mfaRequired: user.totpEnabled,
      enrollRequired: !user.totpEnabled,
    }
  }

  async verifyMfa(username: string, token: string): Promise<void> {
    this.requireDb()
    const user = await this.users.getUser(username)
    if (!user || !user.totpSecret || !user.totpEnabled) {
      throw new UnauthorizedException('MFA no habilitado.')
    }
    // validate() returns the time-step delta (0 = current), or null if invalid.
    if (totpFor(username, user.totpSecret).validate({ token, window: 1 }) === null) {
      throw new UnauthorizedException('Código MFA inválido.')
    }
  }

  // First login: generate a TOTP secret + QR so the user can enroll an app.
  async startEnrollment(username: string): Promise<{ otpauthUrl: string; qrDataUrl: string; secret: string }> {
    this.requireDb()
    const user = await this.users.getUser(username)
    if (!user) throw new UnauthorizedException()
    if (user.totpEnabled) throw new BadRequestException('MFA ya está habilitado.')

    const secret = new OTPAuth.Secret({ size: 20 }).base32
    await this.users.setTotpSecret(username, secret)
    const otpauthUrl = totpFor(username, secret).toString()
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl)
    return { otpauthUrl, qrDataUrl, secret }
  }

  async verifyEnrollment(username: string, token: string): Promise<void> {
    this.requireDb()
    const user = await this.users.getUser(username)
    if (!user || !user.totpSecret) throw new BadRequestException('Enrolamiento no iniciado.')
    if (totpFor(username, user.totpSecret).validate({ token, window: 1 }) === null) {
      throw new UnauthorizedException('Código inválido.')
    }
    await this.users.enableTotp(username)
  }

  private requireDb() {
    if (!this.users.isAvailable()) {
      throw new ServiceUnavailableException(
        'Base de datos no disponible. Levanta Postgres (docker compose up -d) y reinicia el server.',
      )
    }
  }
}
