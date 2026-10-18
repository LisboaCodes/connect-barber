import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CashMovementType, PaymentMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class OpenCashierDto {
  @ApiProperty({ example: 100 }) @IsNumber() @Min(0) openingBalance: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CloseCashierDto {
  @ApiProperty({ description: 'Dinheiro contado na gaveta' }) @IsNumber() @Min(0) closingBalance: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CashMovementDto {
  @ApiProperty({ enum: CashMovementType, description: 'INCOME, EXPENSE, WITHDRAWAL (sangria) ou SUPPLY (suprimento)' })
  @IsEnum(CashMovementType) type: CashMovementType;
  @ApiProperty() @IsNumber() @Min(0.01) amount: number;
  @ApiPropertyOptional({ enum: PaymentMethod, default: 'CASH' }) @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) description?: string;
}
