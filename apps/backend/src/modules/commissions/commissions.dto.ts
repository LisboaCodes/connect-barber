import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAdvanceDto {
  @ApiProperty() @IsString() professionalId: string;
  @ApiProperty() @IsNumber() @Min(0.01) amount: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) description?: string;
  @ApiPropertyOptional({ description: 'Lançar saída no caixa aberto' }) @IsOptional() @IsBoolean() addToCashier?: boolean;
}

export class CreatePayoutDto {
  @ApiProperty() @IsString() professionalId: string;
  @ApiProperty({ example: '2026-10-01' }) @IsDateString() periodStart: string;
  @ApiProperty({ example: '2026-10-31' }) @IsDateString() periodEnd: string;
  @ApiPropertyOptional({ description: 'Descontar vales em aberto', default: true }) @IsOptional() @IsBoolean() deductAdvances?: boolean;
  @ApiPropertyOptional({ description: 'Descontar comandas de consumo fechadas no período', default: true }) @IsOptional() @IsBoolean() deductConsumption?: boolean;
  @ApiPropertyOptional({ description: 'Já marcar como pago' }) @IsOptional() @IsBoolean() paid?: boolean;
  @ApiPropertyOptional({ enum: PaymentMethod }) @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @ApiPropertyOptional({ description: 'Lançar saída no caixa aberto ao pagar' }) @IsOptional() @IsBoolean() addToCashier?: boolean;
}
