import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateServiceDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string | null;
  @ApiProperty({ example: 30 }) @IsInt() @Min(5) @Max(600) durationMinutes: number;
  @ApiProperty({ example: 45 }) @IsNumber() @Min(0) price: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @ApiPropertyOptional({ description: 'Comissão (%) específica; nulo usa a do profissional' })
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionPct?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowOnlineBooking?: boolean;
  @ApiPropertyOptional({ description: 'Dias para a mensagem de retorno automática' })
  @IsOptional() @IsInt() @Min(1) @Max(365) returnDays?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) loyaltyPoints?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ type: [String], description: 'Profissionais que executam; vazio = todos' })
  @IsOptional() @IsArray() professionalIds?: string[];
}

export class UpdateServiceDto extends CreateServiceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(600) durationMinutes: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) price: number;
}

export class CategoryDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(60) name: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() displayOrder?: number;
}
