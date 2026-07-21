import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'

// Allows the request only when the session holds a fully-authenticated user
// (password + second factor). Protects the content API.
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const user = request.session?.user
    if (!user || user.stage !== 'full') {
      throw new UnauthorizedException('No autenticado.')
    }
    return true
  }
}
