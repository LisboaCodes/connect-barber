import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType, OrderItemType, OrderKind, PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class OpenOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() clientId?: string;
  @ApiPropertyOptional({ description: 'Cliente avulso (cria cadastro)' }) @IsOptional() @IsString() clientName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientPhone?: string;
  @ApiPropertyOptional({ description: 'Profissional principal' }) @IsOptional() @IsString() professionalId?: string;
  @ApiPropertyOptional({ description: 'Abrir a partir de um agendamento' }) @IsOptional() @IsString() appointmentId?: string;
  @ApiPropertyOptional({ enum: OrderKind }) @IsOptional() @IsEnum(OrderKind) kind?: OrderKind;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class AddItemDto {
  @ApiProperty({ enum: OrderItemType }) @IsEnum(OrderItemType) type: OrderItemType;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() packageId?: string;
  @ApiPropertyOptional({ description: 'Consumir sessão de pacote do cliente' }) @IsOptional() @IsString() clientPackageItemId?: string;
  @ApiPropertyOptional({ description: 'Quem executou/vendeu (comissão)' }) @IsOptional() @IsString() professionalId?: string;
  @ApiPropertyOptional({ description: 'Descrição (obrigatória para CUSTOM)' }) @IsOptional() @IsString() @MaxLength(200) description?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsNumber() @Min(0.001) quantity?: number;
  @ApiPropertyOptional({ description: 'Preço unitário (padrão: tabela)' }) @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) commissionPct?: number;
}

export class UpdateItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() professionalId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.001) quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) commissionPct?: number | null;
}

export class DiscountDto {
  @ApiPropertyOptional({ enum: DiscountType }) @IsOptional() @IsEnum(DiscountType) discountType?: DiscountType | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discountValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() addToCashier?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() professionalId?: string | null;
}

export class PaymentDto {
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method: PaymentMethod;
  @ApiProperty() @IsNumber() @Min(0.01) amount: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Max(24) installments?: number;
  @ApiPropertyOptional({ description: 'Taxa (%) manual; padrão: configuração da forma de pagamento' }) @IsOptional() @IsNumber() @Min(0) @Max(100) feePct?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional({ description: 'Pontos a resgatar (quando method = LOYALTY_POINTS)' }) @IsOptional() @IsInt() @Min(1) points?: number;
}

export class CloseOrderDto {
  @ApiPropertyOptional({ type: [PaymentDto], description: 'Pagamentos adicionais a lançar antes de fechar' })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentDto) payments?: PaymentDto[];
  @ApiPropertyOptional({ description: 'Permitir fechar com valor em aberto (fiado)' }) @IsOptional() @IsBoolean() allowPartial?: boolean;
}
