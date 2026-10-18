import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class PublicBookingDto {
  @ApiProperty() @IsString() professionalId: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) serviceIds: string[];
  @ApiProperty({ example: '2026-10-20' }) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @ApiProperty({ example: '14:30' }) @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time: string;
  @ApiPropertyOptional({ description: 'Obrigatório se não estiver logado' }) @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @ApiPropertyOptional({ description: 'Obrigatório se não estiver logado' }) @IsOptional() @IsString() @MinLength(8) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @ApiPropertyOptional({ description: 'ONLINE = pagar agora (CreativePay); COUNTER = pagar no balcão', enum: ['ONLINE', 'COUNTER'] })
  @IsOptional() @IsString() payment?: 'ONLINE' | 'COUNTER';
  @ApiPropertyOptional({ description: 'URL de retorno após o checkout' }) @IsOptional() @IsString() returnUrl?: string;
}

export class PublicWaitlistDto {
  @ApiProperty({ example: '2026-10-25' }) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @ApiPropertyOptional() @IsOptional() @IsString() professionalId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(8) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() periodStart?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() periodEnd?: string;
}
