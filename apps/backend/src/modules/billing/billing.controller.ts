import { Body, Controller, Get, Headers, HttpCode, Param, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlanCode } from '@prisma/client';
import { Request } from 'express';
import { Managers, Public, Roles, TenantId } from '../../common/decorators';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @ApiBearerAuth() @Managers() @Get()
  overview(@TenantId() tenantId: string) {
    return this.billing.overview(tenantId);
  }

  @ApiBearerAuth() @Roles('OWNER') @Post('subscribe')
  subscribe(@TenantId() tenantId: string, @Body() body: { planCode: PlanCode }) {
    return this.billing.subscribe(tenantId, body.planCode);
  }

  @ApiBearerAuth() @Roles('OWNER') @Post('invoices/:invoiceId/checkout')
  invoiceCheckout(@TenantId() tenantId: string, @Param('invoiceId') invoiceId: string) {
    return this.billing.invoiceCheckout(tenantId, invoiceId);
  }

  @ApiBearerAuth() @Managers() @Post('orders/:orderId/checkout')
  orderCheckout(@TenantId() tenantId: string, @Param('orderId') orderId: string, @Body() body: { returnUrl?: string }) {
    return this.billing.createOrderCheckout(tenantId, orderId, body?.returnUrl ?? 'https://connect-barber.creativenext.cloud');
  }

  @Public() @HttpCode(200) @Post('webhooks/creative-pay')
  webhook(@Req() req: RawBodyRequest<Request>, @Body() body: any, @Headers() headers: Record<string, any>) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    return this.billing.handleWebhook(raw, headers, body);
  }
}
