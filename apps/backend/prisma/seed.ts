import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Limpar dados existentes
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.cashierSession.deleteMany();
  await prisma.product.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.clientProfile.deleteMany();
  await prisma.professionalProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // Criar tenant de exemplo
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Barbearia Demo',
      slug: 'barbearia-demo',
      plan: 'PRO',
      planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
      maxProfessionals: 5,
      isActive: true,
      settings: {
        openingHours: {
          monday: { start: '09:00', end: '18:00' },
          tuesday: { start: '09:00', end: '18:00' },
          wednesday: { start: '09:00', end: '18:00' },
          thursday: { start: '09:00', end: '18:00' },
          friday: { start: '09:00', end: '18:00' },
          saturday: { start: '09:00', end: '14:00' },
          sunday: { closed: true },
        },
        notifications: {
          email: true,
          whatsapp: true,
          reminderHours: 24,
        },
      },
    },
  });

  console.log(`✅ Tenant created: ${tenant.name}`);

  // Hash de senha padrão
  const hashedPassword = await bcrypt.hash('123456', 10);

  // Criar usuário admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@barbeariademo.com',
      password: hashedPassword,
      name: 'Admin Barbearia',
      phone: '+5511999999999',
      tenantId: tenant.id,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);

  // Criar profissional
  const professionalUser = await prisma.user.create({
    data: {
      email: 'barbeiro@barbeariademo.com',
      password: hashedPassword,
      name: 'João Barbeiro',
      phone: '+5511988888888',
      tenantId: tenant.id,
      role: 'PROFESSIONAL',
      emailVerified: true,
    },
  });

  const professionalProfile = await prisma.professionalProfile.create({
    data: {
      userId: professionalUser.id,
      bio: 'Barbeiro profissional com 10 anos de experiência',
      specialties: ['Corte masculino', 'Barba', 'Degradê'],
      commissionRate: 40, // 40%
      workSchedule: {
        monday: { start: '09:00', end: '18:00' },
        tuesday: { start: '09:00', end: '18:00' },
        wednesday: { start: '09:00', end: '18:00' },
        thursday: { start: '09:00', end: '18:00' },
        friday: { start: '09:00', end: '18:00' },
        saturday: { start: '09:00', end: '14:00' },
      },
    },
  });

  console.log(`✅ Professional created: ${professionalUser.name}`);

  // Criar cliente
  const clientUser = await prisma.user.create({
    data: {
      email: 'cliente@example.com',
      password: hashedPassword,
      name: 'Carlos Cliente',
      phone: '+5511977777777',
      tenantId: tenant.id,
      role: 'CLIENT',
      emailVerified: true,
    },
  });

  const clientProfile = await prisma.clientProfile.create({
    data: {
      userId: clientUser.id,
      loyaltyPoints: 50,
      preferredProfessionalId: professionalProfile.id,
    },
  });

  console.log(`✅ Client created: ${clientUser.name}`);

  // Criar serviços
  const services = await Promise.all([
    prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: 'Corte Masculino',
        description: 'Corte tradicional masculino',
        durationMinutes: 30,
        price: 40.0,
        commissionRate: 40,
      },
    }),
    prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: 'Barba',
        description: 'Aparar e modelar barba',
        durationMinutes: 20,
        price: 25.0,
        commissionRate: 40,
      },
    }),
    prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: 'Corte + Barba',
        description: 'Combo completo',
        durationMinutes: 45,
        price: 60.0,
        commissionRate: 40,
      },
    }),
  ]);

  console.log(`✅ ${services.length} services created`);

  // Criar produtos
  const products = await Promise.all([
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Pomada Modeladora',
        description: 'Pomada de alta fixação',
        price: 35.0,
        stock: 20,
        minStock: 5,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Óleo para Barba',
        description: 'Óleo nutritivo para barba',
        price: 45.0,
        stock: 15,
        minStock: 3,
      },
    }),
  ]);

  console.log(`✅ ${products.length} products created`);

  // Criar alguns agendamentos
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  await prisma.appointment.create({
    data: {
      tenantId: tenant.id,
      clientId: clientUser.id,
      professionalId: professionalProfile.id,
      serviceId: services[0].id,
      scheduledAt: new Date(tomorrow.setHours(10, 0, 0, 0)),
      endAt: new Date(tomorrow.setHours(10, 30, 0, 0)),
      status: 'CONFIRMED',
    },
  });

  console.log('✅ Sample appointment created');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📧 Login credentials:');
  console.log('Admin: admin@barbeariademo.com / 123456');
  console.log('Professional: barbeiro@barbeariademo.com / 123456');
  console.log('Client: cliente@example.com / 123456');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
