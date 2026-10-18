import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { AuthUser } from '../types/auth-user';

export const IS_PUBLIC_KEY = 'isPublic';
/** Rota sem autenticação */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Papéis permitidos na barbearia ativa */
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);

/** Atalho: dono ou gestor */
export const Managers = () => Roles(MemberRole.OWNER, MemberRole.ADMIN);
/** Atalho: equipe operacional (dono, gestor, recepção) */
export const Staff = () => Roles(MemberRole.OWNER, MemberRole.ADMIN, MemberRole.RECEPTION);
/** Atalho: qualquer membro da barbearia */
export const Members = () =>
  Roles(MemberRole.OWNER, MemberRole.ADMIN, MemberRole.RECEPTION, MemberRole.PROFESSIONAL);

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user: AuthUser = ctx.switchToHttp().getRequest().user;
    return data ? user?.[data] : user;
  },
);

/** tenantId da barbearia ativa (erro 403 se o token não tiver contexto de barbearia) */
export const TenantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const user: AuthUser = ctx.switchToHttp().getRequest().user;
  if (!user?.tenantId) {
    throw new ForbiddenException('Selecione uma barbearia para continuar');
  }
  return user.tenantId;
});
