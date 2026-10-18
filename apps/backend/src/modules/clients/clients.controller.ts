import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Members, Staff, TenantId } from '../../common/decorators';
import { CreateClientDto, ImportClientsDto, UpdateClientDto } from './clients.dto';
import { ClientListQuery, ClientsService } from './clients.service';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Members() @Get()
  list(@TenantId() tenantId: string, @Query() q: ClientListQuery) {
    return this.clients.list(tenantId, q);
  }

  @Members() @Get('birthdays')
  birthdays(@TenantId() tenantId: string, @Query('month') month?: string, @Query('day') day?: string) {
    return this.clients.birthdays(tenantId, month ? Number(month) : undefined, day ? Number(day) : undefined);
  }

  @Members() @Get('tags')
  tags(@TenantId() tenantId: string) {
    return this.clients.listTags(tenantId);
  }

  @Staff() @Post('import')
  import(@TenantId() tenantId: string, @Body() dto: ImportClientsDto) {
    return this.clients.import(tenantId, dto.items);
  }

  @Members() @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.clients.get(tenantId, id);
  }

  @Members() @Get(':id/history')
  history(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.clients.history(tenantId, id);
  }

  @Members() @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateClientDto) {
    return this.clients.create(tenantId, dto);
  }

  @Members() @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(tenantId, id, dto);
  }

  @Staff() @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.clients.remove(tenantId, id);
  }
}
