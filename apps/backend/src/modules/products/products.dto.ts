import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() sku?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() barcode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brand?: string;
  @ApiPropertyOptional({ default: 'un' }) @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @ApiProperty() @IsNumber() @Min(0) salePrice: number;
  @ApiPropertyOptional({ description: 'Estoque inicial' }) @IsOptional() @IsNumber() @Min(0) stock?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) minStock?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) commissionPct?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() forSale?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() forInternalUse?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) loyaltyPoints?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateProductDto extends CreateProductDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) salePrice: number;
}

export class StockMovementDto {
  @ApiProperty({ enum: StockMovementType, description: 'IN, OUT, USE, LOSS, ADJUST' }) @IsEnum(StockMovementType) type: StockMovementType;
  @ApiProperty({ description: 'Quantidade (positiva). Para ADJUST é o novo saldo.' }) @IsNumber() @Min(0) quantity: number;
  @ApiPropertyOptional({ description: 'Custo unitário (entradas)' }) @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @ApiPropertyOptional({ description: 'Atualizar o preço de custo do produto com este custo' }) @IsOptional() @IsBoolean() updateCost?: boolean;
}

export class ProductCategoryDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(60) name: string;
}
