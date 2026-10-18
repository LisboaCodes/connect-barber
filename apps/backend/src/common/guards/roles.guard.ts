import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemberRole } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators';
import { AuthUser } from '../types/auth-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const roles = this.reflector.getAllAndOverride<MemberRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const user: AuthUser = context.switchToHttp().getRequest().user;
    if (user?.isSuperAdmin) return true;
    if (!user?.tenantId || !user.role) {
      throw new ForbiddenException('Selecione uma barbearia para continuar');
    }
    if (!roles.includes(user.role)) {
      throw new ForbiddenException('Você não tem permissão para esta ação');
    }
    return true;
  }
}
