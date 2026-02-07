import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    // Middleware para tenant isolation
    this.$use(async (params, next) => {
      // Pula middleware para modelo Tenant
      if (params.model === 'Tenant') {
        return next(params);
      }

      // Para outros modelos que têm tenantId
      const modelsWithTenant = [
        'User',
        'Service',
        'Appointment',
        'Product',
        'CashierSession',
      ];

      if (modelsWithTenant.includes(params.model || '')) {
        // Aqui seria injetado o tenantId do contexto da requisição
        // Por enquanto, apenas passamos a query adiante
        // A injeção real será feita via interceptor
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔌 Database disconnected');
  }

  // Helper para soft delete
  async softDelete(model: any, where: any) {
    return model.update({
      where,
      data: {
        deletedAt: new Date(),
      },
    });
  }

  // Helper para limpar dados de teste
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase only available in test environment');
    }

    const models = [
      'AuditLog',
      'Transaction',
      'CashierSession',
      'Product',
      'Appointment',
      'Service',
      'ClientProfile',
      'ProfessionalProfile',
      'User',
      'Tenant',
    ];

    for (const model of models) {
      await (this as any)[model.charAt(0).toLowerCase() + model.slice(1)].deleteMany();
    }
  }
}
