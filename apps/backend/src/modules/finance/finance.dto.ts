import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceType, PaymentMethod } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateFinanceEntryDto {
  @ApiProperty({ enum: FinanceType }) @IsEnum(FinanceType) type: FinanceType;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200) description: string;
  @ApiProperty() @IsNumber() @Min(0.01) amount: number;
  @ApiProperty({ example: '2026-11-05' }) @IsDateString() dueDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() supplier?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiPropertyOptional({ description: 'Nº de parcelas mensais a gerar', default: 1 }) @IsOptional() @IsInt() @Min(1) @Max(60) installments?: number;
  @ApiPropertyOptional({ description: 'Já marcar como pago' }) @IsOptional() @IsBoolean() paid?: boolean;
  @ApiPropertyOptional({ enum: PaymentMethod }) @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @ApiPropertyOptional({ description: 'Lançar também no caixa aberto (dinheiro)' }) @IsOptional() @IsBoolean() addToCashier?: boolean;
}

export class UpdateFinanceEntryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(200) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() supplier?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class PayFinanceEntryDto {
  @ApiPropertyOptional({ description: 'Valor pago (padrão: valor total)' }) @IsOptional() @IsNumber() @Min(0.01) paidAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() paidAt?: string;
  @ApiPropertyOptional({ enum: PaymentMethod }) @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @ApiPropertyOptional({ description: 'Lançar no caixa aberto' }) @IsOptional() @IsBoolean() addToCashier?: boolean;
}

export class FinanceCategoryDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(60) name: string;
  @ApiProperty({ enum: FinanceType }) @IsEnum(FinanceType) type: FinanceType;
}
