import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Staff, TenantId } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import { CashMovementDto, CloseCashierDto, OpenCashierDto } from './cashier.dto';
import { CashierService } from './cashier.service';

@ApiTags('cashier')
@ApiBearerAuth()
@Staff()
@Controller('cashier')
export class CashierController {
  constructor(private readonly cashier: CashierService) {}

  @Get('current')
  current(@TenantId() tenantId: string) {
    return this.cashier.current(tenantId);
  }

  @Get('history')
  history(@TenantId() tenantId: string, @Query() q: any) {
    return this.cashier.history(tenantId, q);
  }

  @Get('sessions/:id')
  session(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.cashier.getSession(tenantId, id);
  }

  @Post('open')
  open(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Body() dto: OpenCashierDto) {
    return this.cashier.open(tenantId, actor, dto);
  }

  @Post('close')
  close(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Body() dto: CloseCashierDto) {
    return this.cashier.close(tenantId, actor, dto);
  }

  @Post('movements')
  movement(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Body() dto: CashMovementDto) {
    return this.cashier.addMovement(tenantId, actor, dto);
  }

  @Delete('movements/:id')
  removeMovement(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.cashier.removeMovement(tenantId, id);
  }
}
