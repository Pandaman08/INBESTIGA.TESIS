import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY, ROLES_KEY, RolUsuario } from './auth.decorators';

/**
 * Guard global (APP_GUARD): toda ruta exige un JWT válido y rol ADMIN, salvo que
 * esté marcada con @Public() o declare otros roles con @Roles(...).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const autenticado = (await super.canActivate(context)) as boolean;
    if (!autenticado) return false;

    const roles = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES_KEY, targets) ?? ['ADMIN'];
    const user = context.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.rol)) {
      throw new ForbiddenException('No tiene permisos para esta operación.');
    }
    return true;
  }
}
