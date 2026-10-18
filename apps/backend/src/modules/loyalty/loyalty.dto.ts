import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class LoyaltyProgramDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) name?: string;
  @ApiPropertyOptional({ description: 'Pontos por R$ 1,00' }) @IsOptional() @IsNumber() @Min(0) pointsPerCurrency?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() includeProducts?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) pointsExpireDays?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

export class LoyaltyRewardDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name: string;
  @ApiProperty() @IsInt() @Min(1) pointsCost: number;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() productId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discountAmount?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AdjustPointsDto {
  @ApiProperty({ description: 'Positivo adiciona, negativo remove' }) @IsInt() points: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) description?: string;
}

export class PackageItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productId?: string;
  @ApiProperty() @IsInt() @Min(1) quantity: number;
}

export class PackageDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiProperty() @IsNumber() @Min(0) price: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) validityDays?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() sellOnline?: boolean;
  @ApiProperty({ type: [PackageItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => PackageItemDto) items: PackageItemDto[];
}

export class ClubDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiProperty() @IsNumber() @Min(0) @Max(100) discountPct: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() appliesToServices?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() appliesToProducts?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) monthlyFee?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
