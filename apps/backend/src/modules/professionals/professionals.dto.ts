import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OverrideType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateProfessionalDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showOnSite?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() acceptsOnlineBooking?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) serviceCommissionPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) productCommissionPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ type: [String], description: 'IDs dos serviços que executa; vazio = todos' })
  @IsOptional() @IsArray() serviceIds?: string[];
  @ApiPropertyOptional({ description: 'Criar acesso de login para o profissional' })
  @IsOptional() @IsBoolean() createAccess?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(6) password?: string;
}

export class UpdateProfessionalDto extends CreateProfessionalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name: string;
}

export class WorkScheduleRangeDto {
  @ApiProperty({ example: 1, description: '0=domingo ... 6=sábado' }) @IsInt() @Min(0) @Max(6) weekday: number;
  @ApiProperty({ example: '09:00' }) @IsString() @Matches(TIME) startTime: string;
  @ApiProperty({ example: '18:00' }) @IsString() @Matches(TIME) endTime: string;
}

export class SetWorkScheduleDto {
  @ApiProperty({ type: [WorkScheduleRangeDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => WorkScheduleRangeDto) ranges: WorkScheduleRangeDto[];
}

export class CreateOverrideDto {
  @ApiProperty({ example: '2026-12-24' }) @IsDateString() date: string;
  @ApiProperty({ enum: OverrideType }) @IsEnum(OverrideType) type: OverrideType;
  @ApiPropertyOptional({ example: '08:00' }) @IsOptional() @IsString() @Matches(TIME) startTime?: string;
  @ApiPropertyOptional({ example: '22:00' }) @IsOptional() @IsString() @Matches(TIME) endTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class CreateBlockDto {
  @ApiPropertyOptional({ description: 'Nulo = toda a barbearia' }) @IsOptional() @IsString() professionalId?: string;
  @ApiProperty({ example: '2026-10-20T12:00:00-03:00' }) @IsDateString() startAt: string;
  @ApiProperty({ example: '2026-10-20T13:00:00-03:00' }) @IsDateString() endAt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
