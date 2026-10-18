/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seed idempotente:
 *  - superadmin da plataforma (ADMIN_EMAIL / ADMIN_PASSWORD)
 *  - barbearia de demonstração (SEED_DEMO=true) com equipe, serviços, produtos, clientes e agenda
 */
async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@connectbarber.app').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { isSuperAdmin: true },
    create: { email: adminEmail, name: 'Administrador Connect Barber', password: await bcrypt.hash(adminPassword, 10), isSuperAdmin: true, emailVerified: true },
  });
  console.log(`✅ Superadmin: ${admin.email}`);

  if (process.env.SEED_DEMO !== 'true') {
    console.log('ℹ️  SEED_DEMO != true: barbearia de demonstração não criada');
    return;
  }

  const existing = await prisma.tenant.findUnique({ where: { slug: 'barbearia-demo' } });
  if (existing) {
    console.log('ℹ️  Barbearia demo já existe');
    return;
  }

  const password = await bcrypt.hash('123456', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'dono@barbeariademo.com' },
    update: {},
    create: { email: 'dono@barbeariademo.com', name: 'Zé Barbeiro', phone: '5511999990001', password, emailVerified: true },
  });
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Barbearia Demo',
      slug: 'barbearia-demo',
      email: 'dono@barbeariademo.com',
      phone: '5511999990001',
      whatsapp: '5511999990001',
      description: 'Cortes clássicos e modernos no coração da cidade.',
      siteAbout: 'Desde 2015 cuidando do visual de quem valoriza um bom corte. Ambiente climatizado, cerveja gelada e atendimento com hora marcada.',
      addressStreet: 'Rua das Tesouras',
      addressNumber: '123',
      addressDistrict: 'Centro',
      addressCity: 'São Paulo',
      addressState: 'SP',
      addressZip: '01310-100',
      coverUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1800&q=80',
      siteGallery: [
        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&q=80',
        'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=900&q=80',
        'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=900&q=80',
        'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=900&q=80',
        'https://images.unsplash.com/photo-1593702275687-f8b402bf1fb5?w=900&q=80',
      ],
      siteInstagram: 'barbeariademo',
      sitePaymentInfo: 'Dinheiro, Pix, cartão de débito e crédito (até 3x sem juros)',
      openingHours: { 0: [], 1: [{ start: '09:00', end: '19:00' }], 2: [{ start: '09:00', end: '19:00' }], 3: [{ start: '09:00', end: '19:00' }], 4: [{ start: '09:00', end: '19:00' }], 5: [{ start: '09:00', end: '20:00' }], 6: [{ start: '09:00', end: '17:00' }] },
      reminderChannels: ['WHATSAPP', 'EMAIL'],
      trialEndsAt: new Date(Date.now() + 30 * 86400000),
      onboardingStep: 9,
      surveyEnabled: true,
      birthdayMessageEnabled: true,
    },
  });
  const ownerMembership = await prisma.membership.create({ data: { tenantId: tenant.id, userId: owner.id, role: 'OWNER' } });

  // categorias financeiras e formas de pagamento
  await prisma.financeCategory.createMany({
    data: [
      { tenantId: tenant.id, name: 'Serviços', type: 'INCOME', isSystem: true },
      { tenantId: tenant.id, name: 'Produtos', type: 'INCOME', isSystem: true },
      { tenantId: tenant.id, name: 'Outras receitas', type: 'INCOME', isSystem: true },
      { tenantId: tenant.id, name: 'Aluguel', type: 'EXPENSE', isSystem: true },
      { tenantId: tenant.id, name: 'Água, luz e internet', type: 'EXPENSE', isSystem: true },
      { tenantId: tenant.id, name: 'Fornecedores', type: 'EXPENSE', isSystem: true },
      { tenantId: tenant.id, name: 'Comissões', type: 'EXPENSE', isSystem: true },
      { tenantId: tenant.id, name: 'Marketing', type: 'EXPENSE', isSystem: true },
      { tenantId: tenant.id, name: 'Outras despesas', type: 'EXPENSE', isSystem: true },
    ],
  });
  await prisma.paymentMethodConfig.createMany({
    data: [
      { tenantId: tenant.id, method: 'CASH', label: 'Dinheiro', feePct: 0, maxInstallments: 1 },
      { tenantId: tenant.id, method: 'PIX', label: 'Pix', feePct: 0, maxInstallments: 1 },
      { tenantId: tenant.id, method: 'DEBIT_CARD', label: 'Cartão de débito', feePct: 1.5, maxInstallments: 1 },
      { tenantId: tenant.id, method: 'CREDIT_CARD', label: 'Cartão de crédito', feePct: 3.5, maxInstallments: 12, installmentFees: { '2': 4.5, '3': 5.5 } },
    ],
  });

  // profissionais
  const schedule = (id: string) => [
    ...[1, 2, 3, 4, 5].flatMap((d) => [
      { professionalId: id, weekday: d, startTime: '09:00', endTime: '12:00' },
      { professionalId: id, weekday: d, startTime: '13:00', endTime: '19:00' },
    ]),
    { professionalId: id, weekday: 6, startTime: '09:00', endTime: '17:00' },
  ];
  const ze = await prisma.professional.create({ data: { tenantId: tenant.id, membershipId: ownerMembership.id, name: 'Zé Barbeiro', phone: '5511999990001', email: 'dono@barbeariademo.com', color: '#e3192c', serviceCommissionPct: 0, productCommissionPct: 0, bio: 'Fundador. Especialista em cortes clássicos e navalha.', avatarUrl: 'https://i.pravatar.cc/300?img=12' } });
  const proUser = await prisma.user.upsert({ where: { email: 'barbeiro@barbeariademo.com' }, update: {}, create: { email: 'barbeiro@barbeariademo.com', name: 'João Silva', phone: '5511999990002', password, emailVerified: true } });
  const proMembership = await prisma.membership.create({ data: { tenantId: tenant.id, userId: proUser.id, role: 'PROFESSIONAL' } });
  const joao = await prisma.professional.create({ data: { tenantId: tenant.id, membershipId: proMembership.id, name: 'João Silva', phone: '5511999990002', email: 'barbeiro@barbeariademo.com', color: '#3b82f6', serviceCommissionPct: 40, productCommissionPct: 10, bio: 'Degradê, freestyle e barba desenhada.', displayOrder: 1, avatarUrl: 'https://i.pravatar.cc/300?img=33' } });
  const pedro = await prisma.professional.create({ data: { tenantId: tenant.id, name: 'Pedro Santos', phone: '5511999990003', color: '#10b981', serviceCommissionPct: 45, productCommissionPct: 10, bio: 'Barboterapia e tratamentos.', displayOrder: 2, avatarUrl: 'https://i.pravatar.cc/300?img=52' } });
  await prisma.workSchedule.createMany({ data: [...schedule(ze.id), ...schedule(joao.id), ...schedule(pedro.id)] });

  // serviços
  const catCorte = await prisma.serviceCategory.create({ data: { tenantId: tenant.id, name: 'Cortes', displayOrder: 0 } });
  const catBarba = await prisma.serviceCategory.create({ data: { tenantId: tenant.id, name: 'Barba', displayOrder: 1 } });
  const catCombo = await prisma.serviceCategory.create({ data: { tenantId: tenant.id, name: 'Combos', displayOrder: 2 } });
  const services = await Promise.all([
    prisma.service.create({ data: { tenantId: tenant.id, categoryId: catCorte.id, name: 'Corte masculino', description: 'Corte clássico ou moderno com acabamento na navalha.', durationMinutes: 30, price: 45, color: '#e3192c', returnDays: 25, displayOrder: 0, imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80' } }),
    prisma.service.create({ data: { tenantId: tenant.id, categoryId: catCorte.id, name: 'Corte degradê', description: 'Fade baixo, médio ou alto, com desenho opcional.', durationMinutes: 40, price: 55, color: '#f97316', returnDays: 20, displayOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&q=80' } }),
    prisma.service.create({ data: { tenantId: tenant.id, categoryId: catCorte.id, name: 'Corte infantil', durationMinutes: 30, price: 35, displayOrder: 2 } }),
    prisma.service.create({ data: { tenantId: tenant.id, categoryId: catBarba.id, name: 'Barba', description: 'Modelagem com toalha quente e finalização com óleo.', durationMinutes: 25, price: 35, color: '#3b82f6', displayOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&q=80' } }),
    prisma.service.create({ data: { tenantId: tenant.id, categoryId: catBarba.id, name: 'Barboterapia', durationMinutes: 40, price: 60, displayOrder: 4 } }),
    prisma.service.create({ data: { tenantId: tenant.id, categoryId: catCombo.id, name: 'Corte + Barba', description: 'O combo completo para sair renovado.', durationMinutes: 55, price: 75, color: '#8b5cf6', returnDays: 25, displayOrder: 5, imageUrl: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&q=80' } }),
    prisma.service.create({ data: { tenantId: tenant.id, name: 'Sobrancelha', durationMinutes: 10, price: 15, displayOrder: 6 } }),
    prisma.service.create({ data: { tenantId: tenant.id, name: 'Pigmentação', durationMinutes: 30, price: 50, displayOrder: 7, allowOnlineBooking: false } }),
  ]);

  // produtos
  const catProd = await prisma.productCategory.create({ data: { tenantId: tenant.id, name: 'Cosméticos' } });
  const catBar = await prisma.productCategory.create({ data: { tenantId: tenant.id, name: 'Bar' } });
  const products = await Promise.all([
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: catProd.id, name: 'Pomada modeladora', brand: 'Barba Forte', costPrice: 18, salePrice: 39.9, stock: 24, minStock: 5, commissionPct: 10 } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: catProd.id, name: 'Óleo para barba 30ml', brand: 'Don Alcides', costPrice: 22, salePrice: 49.9, stock: 12, minStock: 4 } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: catProd.id, name: 'Shampoo anticaspa', costPrice: 15, salePrice: 32, stock: 3, minStock: 5 } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: catBar.id, name: 'Cerveja long neck', costPrice: 4.5, salePrice: 10, stock: 48, minStock: 12 } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: catBar.id, name: 'Refrigerante lata', costPrice: 2.5, salePrice: 6, stock: 30, minStock: 10 } }),
    prisma.product.create({ data: { tenantId: tenant.id, name: 'Lâmina de barbear (uso interno)', costPrice: 0.8, salePrice: 0, stock: 200, minStock: 50, forSale: false, forInternalUse: true } }),
  ]);
  for (const p of products) {
    await prisma.stockMovement.create({ data: { tenantId: tenant.id, productId: p.id, type: 'IN', quantity: p.stock, unitCost: p.costPrice, balanceAfter: p.stock, reason: 'Estoque inicial' } });
  }

  // fidelidade, clube e pacote
  const program = await prisma.loyaltyProgram.create({ data: { tenantId: tenant.id, isActive: true, name: 'Clube de Pontos Demo', pointsPerCurrency: 1, description: 'A cada R$ 1 você ganha 1 ponto. Troque por serviços!' } });
  await prisma.loyaltyReward.createMany({ data: [
    { programId: program.id, name: 'Sobrancelha grátis', pointsCost: 150, serviceId: services[6].id },
    { programId: program.id, name: 'Corte grátis', pointsCost: 450, serviceId: services[0].id },
    { programId: program.id, name: 'R$ 20 de desconto', pointsCost: 200, discountAmount: 20 },
  ] });
  const club = await prisma.clientClub.create({ data: { tenantId: tenant.id, name: 'Clube VIP', description: '10% de desconto em todos os serviços', discountPct: 10, monthlyFee: 29.9 } });
  await prisma.package.create({ data: { tenantId: tenant.id, name: '4 cortes + 2 barbas', description: 'Economize 15%', price: 210, validityDays: 90, sellOnline: true, items: { create: [{ serviceId: services[0].id, quantity: 4 }, { serviceId: services[3].id, quantity: 2 }] } } });
  await prisma.returnRule.create({ data: { tenantId: tenant.id, daysAfter: 25, message: 'Olá {{cliente}}! Já faz quase um mês do seu último corte na {{barbearia}}. Que tal renovar o visual? Agende: {{link}}', channels: ['WHATSAPP'] } });

  // clientes
  const names = ['Carlos Andrade', 'Rafael Lima', 'Bruno Costa', 'Lucas Ferreira', 'Marcos Oliveira', 'Thiago Souza', 'Felipe Rocha', 'Diego Martins', 'André Pereira', 'Gustavo Alves', 'Rodrigo Nunes', 'Vinícius Barros'];
  const clientUser = await prisma.user.upsert({ where: { email: 'cliente@example.com' }, update: {}, create: { email: 'cliente@example.com', name: 'Carlos Andrade', phone: '5511988880001', password, emailVerified: true } });
  const clients = [];
  for (const [i, name] of names.entries()) {
    const c = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        name,
        phone: `551198888${String(i + 1).padStart(4, '0')}`,
        email: i === 0 ? 'cliente@example.com' : `${name.split(' ')[0].toLowerCase()}${i}@example.com`,
        userId: i === 0 ? clientUser.id : null,
        birthDate: new Date(Date.UTC(1985 + i, (new Date().getMonth() + (i % 3)) % 12, 1 + (i * 2) % 28)),
        tags: i % 4 === 0 ? ['vip'] : [],
        clubId: i % 4 === 0 ? club.id : null,
        preferredProfessionalId: [ze.id, joao.id, pedro.id][i % 3],
        source: 'ADMIN',
      },
    });
    clients.push(c);
  }

  // agenda: últimos 10 dias e próximos 5
  const pros = [ze, joao, pedro];
  const tz = -3; // America/Sao_Paulo (sem DST)
  const mk = (daysFromNow: number, hour: number, min = 0) => {
    const d = new Date();
    d.setUTCHours(hour - tz, min, 0, 0);
    d.setUTCDate(d.getUTCDate() + daysFromNow);
    return d;
  };
  let seq = 0;
  for (let day = -10; day <= 5; day++) {
    const dow = mk(day, 12).getUTCDay();
    if (dow === 0) continue;
    for (const [pi, pro] of pros.entries()) {
      const hours = [9, 10, 11, 14, 15, 16, 17].filter((_, i) => (i + day + pi) % 3 !== 0);
      for (const h of hours) {
        const client = clients[(h + day + pi * 3 + 100) % clients.length];
        const svc = services[(h + pi) % 6];
        const start = mk(day, h);
        const end = new Date(start.getTime() + svc.durationMinutes * 60000);
        const past = day < 0 || (day === 0 && h < new Date().getUTCHours() + tz);
        const status = past ? ((h + day) % 9 === 0 ? 'NO_SHOW' : (h + day) % 11 === 0 ? 'CANCELLED' : 'COMPLETED') : day === 0 ? 'CONFIRMED' : (h % 2 ? 'CONFIRMED' : 'SCHEDULED');
        const a = await prisma.appointment.create({
          data: {
            tenantId: tenant.id, clientId: client.id, professionalId: pro.id, startAt: start, endAt: end, status: status as any,
            source: h % 3 === 0 ? 'SITE' : 'ADMIN', totalPrice: svc.price, totalDuration: svc.durationMinutes,
            confirmedAt: status !== 'SCHEDULED' ? start : null, completedAt: status === 'COMPLETED' ? end : null,
            services: { create: [{ serviceId: svc.id, price: svc.price, durationMinutes: svc.durationMinutes }] },
          },
        });
        if (status === 'COMPLETED') {
          seq++;
          const price = Number(svc.price);
          const prodSale = h % 4 === 0 ? products[Math.abs(h + day) % 2] : null;
          const prodTotal = prodSale ? Number(prodSale.salePrice) : 0;
          const total = price + prodTotal;
          const commPct = Number(pro.serviceCommissionPct);
          const order = await prisma.order.create({
            data: {
              tenantId: tenant.id, number: seq, status: 'CLOSED', clientId: client.id, professionalId: pro.id, subtotal: total, total, paidTotal: total, openedAt: start, closedAt: end, loyaltyPointsEarned: Math.floor(total),
              items: { create: [
                { type: 'SERVICE', serviceId: svc.id, professionalId: pro.id, description: svc.name, quantity: 1, unitPrice: price, total: price, commissionPct: commPct, commissionAmount: Math.round(price * commPct) / 100 },
                ...(prodSale ? [{ type: 'PRODUCT' as const, productId: prodSale.id, professionalId: pro.id, description: prodSale.name, quantity: 1, unitPrice: prodTotal, total: prodTotal, commissionPct: Number(prodSale.commissionPct ?? pro.productCommissionPct), commissionAmount: Math.round(prodTotal * Number(prodSale.commissionPct ?? pro.productCommissionPct)) / 100 }] : []),
              ] },
              payments: { create: [{ method: (['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD'] as const)[Math.abs(h + day) % 4], amount: total, netAmount: total }] },
            },
            include: { items: true },
          });
          await prisma.appointment.update({ where: { id: a.id }, data: { orderId: order.id } });
          for (const item of order.items) {
            if (Number(item.commissionAmount) > 0) {
              await prisma.commissionEntry.create({ data: { tenantId: tenant.id, professionalId: pro.id, orderId: order.id, orderItemId: item.id, baseAmount: item.total, pct: item.commissionPct ?? 0, amount: item.commissionAmount, referenceDate: end } });
            }
          }
          await prisma.client.update({ where: { id: client.id }, data: { visitsCount: { increment: 1 }, totalSpent: { increment: total }, lastVisitAt: end, loyaltyPoints: { increment: Math.floor(total) } } });
          await prisma.loyaltyTransaction.create({ data: { tenantId: tenant.id, clientId: client.id, type: 'EARN', points: Math.floor(total), balanceAfter: 0, orderId: order.id, description: `Comanda #${seq}` } });
        }
      }
    }
  }
  await prisma.tenant.update({ where: { id: tenant.id }, data: { orderSeq: seq } });

  // despesas
  const catAluguel = await prisma.financeCategory.findFirst({ where: { tenantId: tenant.id, name: 'Aluguel' } });
  const catLuz = await prisma.financeCategory.findFirst({ where: { tenantId: tenant.id, name: 'Água, luz e internet' } });
  await prisma.financeEntry.createMany({ data: [
    { tenantId: tenant.id, type: 'EXPENSE', status: 'PAID', categoryId: catAluguel!.id, description: 'Aluguel do salão', amount: 2500, dueDate: mk(-5, 12), paidAt: mk(-5, 12), paidAmount: 2500, method: 'TRANSFER' },
    { tenantId: tenant.id, type: 'EXPENSE', status: 'PENDING', categoryId: catLuz!.id, description: 'Conta de luz', amount: 380, dueDate: mk(3, 12) },
    { tenantId: tenant.id, type: 'EXPENSE', status: 'PENDING', categoryId: catAluguel!.id, description: 'Aluguel do salão', amount: 2500, dueDate: mk(25, 12) },
  ] });

  console.log(`✅ Barbearia demo criada: /b/${tenant.slug}`);
  console.log('   Dono: dono@barbeariademo.com / 123456');
  console.log('   Profissional: barbeiro@barbeariademo.com / 123456');
  console.log('   Cliente: cliente@example.com / 123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed falhou:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
