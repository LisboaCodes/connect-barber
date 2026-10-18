import { PlanCode } from '@prisma/client';

export interface PlanDef {
  code: PlanCode;
  name: string;
  minProfessionals: number;
  maxProfessionals: number; // 999 = ilimitado
  monthlyPrice: number;     // preço cheio
  promoPrice: number;       // preço promocional (30% off)
  description: string;
}

export const TRIAL_DAYS = 30;

export const PLANS: PlanDef[] = [
  { code: 'TRIAL', name: 'Teste grátis', minProfessionals: 1, maxProfessionals: 999, monthlyPrice: 0, promoPrice: 0, description: '30 dias com todas as funcionalidades' },
  { code: 'P1', name: '1 Profissional', minProfessionals: 1, maxProfessionals: 1, monthlyPrice: 79.9, promoPrice: 55.9, description: 'Para quem trabalha sozinho' },
  { code: 'P2_5', name: '2 a 5 Profissionais', minProfessionals: 2, maxProfessionals: 5, monthlyPrice: 109.9, promoPrice: 76.9, description: 'Barbearias em crescimento' },
  { code: 'P6_15', name: '6 a 15 Profissionais', minProfessionals: 6, maxProfessionals: 15, monthlyPrice: 164.5, promoPrice: 115.15, description: 'Equipes maiores' },
  { code: 'P15_PLUS', name: 'Mais de 15 Profissionais', minProfessionals: 16, maxProfessionals: 999, monthlyPrice: 219.9, promoPrice: 153.9, description: 'Redes e grandes unidades' },
];

export function planForProfessionals(n: number): PlanDef {
  return PLANS.find((p) => p.code !== 'TRIAL' && n >= p.minProfessionals && n <= p.maxProfessionals) ?? PLANS[PLANS.length - 1];
}
