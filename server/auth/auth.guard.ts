import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { bypasses } from './devBypass'

// Allows the request only when the session holds a fully-authenticated user
// (password + second factor), or when the development bypass is on and the
// request is local (devBypass.ts). Protects the content API.
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    if (bypasses(request)) return true
    const user = request.session?.user
    if (!user || user.stage !== 'full') {
      throw new UnauthorizedException('No autenticado.')
    }
    return true
  }
}
