import { MemberRole } from '@prisma/client';

/** Payload do JWT / usuário autenticado na requisição */
export interface AuthUser {
  sub: string; // userId
  email: string;
  name: string;
  isSuperAdmin: boolean;
  /** Contexto da barbearia ativa (ausente para cliente final sem vínculo) */
  tenantId?: string;
  membershipId?: string;
  role?: MemberRole;
  professionalId?: string;
  permissions?: Record<string, boolean>;
}

export interface TenantContext {
  tenantId: string;
  role: MemberRole;
  userId: string;
  professionalId?: string;
}
