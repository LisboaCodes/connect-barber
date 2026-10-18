import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, RawBodyRequest, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BadRequestException } from '@nestjs/common';
import { Members, Public, TenantId } from '../../common/decorators';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { money } from '../../common/utils';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService, private prisma: PrismaService) {}

  @ApiBearerAuth() @Members() @Post('orders/:orderId/pix')
  @ApiOperation({ summary: 'Gera Pix (QR code) do saldo da comanda pelo CreativePay da barbearia' })
  async orderPix(@TenantId() tenantId: string, @Param('orderId') orderId: string, @Body() body: { amount?: number }) {
    const { tenant, order, remaining } = await this.orderContext(tenantId, orderId);
    const amount = money(body?.amount ?? remaining);
    if (amount > remaining + 0.009) throw new BadRequestException(`Valor maior que o restante (R$ ${remaining.toFixed(2)})`);
    return this.payments.createCharge(tenant, { kind: 'PIX', amount, orderId, clientId: order.clientId ?? undefined, description: `Comanda #${order.number}`, customer: order.client ?? { id: order.id, name: 'Cliente' } });
  }

  @ApiBearerAuth() @Members() @Post('orders/:orderId/pos')
  @ApiOperation({ summary: 'Envia a cobrança para a maquininha (Mercado Pago Point)' })
  async orderPos(@TenantId() tenantId: string, @Param('orderId') orderId: string, @Body() body: { amount?: number }) {
    const { tenant, order, remaining } = await this.orderContext(tenantId, orderId);
    const amount = money(body?.amount ?? remaining);
    if (amount > remaining + 0.009) throw new BadRequestException(`Valor maior que o restante (R$ ${remaining.toFixed(2)})`);
    return this.payments.createPosCharge(tenant, { amount, orderId, clientId: order.clientId ?? undefined, description: `Comanda #${order.number}` });
  }

  @ApiBearerAuth() @Members() @Get('orders/:orderId/intents')
  listOrderIntents(@TenantId() tenantId: string, @Param('orderId') orderId: string) {
    return this.payments.listFor(tenantId, { orderId });
  }

  @ApiBearerAuth() @Members() @Get('intents/:id')
  getIntent(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payments.getIntent(id, tenantId);
  }

  @ApiBearerAuth() @Members() @Post('intents/:id/cancel')
  cancel(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payments.cancelIntent(tenantId, id);
  }

  /** Consulta pública do status (totem, site, área do cliente) — só pelo id da cobrança */
  @Public() @Get('public/intents/:id')
  async publicIntent(@Param('id') id: string, @Query('poll') _poll?: string) {
    const i = await this.payments.getIntent(id);
    return { id: i.id, status: i.status, amount: i.amount, kind: i.kind, qrCode: i.qrCode, copyPaste: i.copyPaste, checkoutUrl: i.checkoutUrl, expiresAt: i.expiresAt, orderId: i.orderId, appointmentId: i.appointmentId };
  }

  @Public() @HttpCode(200) @Post('webhooks/creative-pay/:tenantId')
  webhook(@Param('tenantId') tenantId: string, @Req() req: RawBodyRequest<Request>, @Body() body: any, @Headers() headers: Record<string, any>) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    return this.payments.handleTenantWebhook(tenantId, raw, headers, body);
  }

  private async orderContext(tenantId: string, orderId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId }, include: { client: true } });
    if (!order) throw new BadRequestException('Comanda não encontrada');
    if (order.status !== 'OPEN') throw new BadRequestException('Comanda não está aberta');
    const remaining = money(Number(order.total) - Number(order.paidTotal));
    if (remaining <= 0) throw new BadRequestException('Comanda já está paga');
    return { tenant, order, remaining };
  }
}
