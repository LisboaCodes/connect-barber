import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus, RecurrenceFrequency } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecurrenceDto {
  @ApiProperty({ enum: RecurrenceFrequency }) @IsEnum(RecurrenceFrequency) frequency: RecurrenceFrequency;
  @ApiPropertyOptional({ description: 'Quantas ocorrências gerar (máx. 52)', default: 12 }) @IsOptional() @IsInt() @Min(2) @Max(52) occurrences?: number;
  @ApiPropertyOptional({ example: '2027-03-31' }) @IsOptional() @IsDateString() endsOn?: string;
}

export class CreateAppointmentDto {
  @ApiProperty() @IsString() professionalId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientId?: string;
  @ApiPropertyOptional({ description: 'Cliente novo: nome (cria o cadastro)' }) @IsOptional() @IsString() @MaxLength(100) clientName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientEmail?: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) serviceIds: string[];
  @ApiProperty({ example: '2026-10-20' }) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @ApiProperty({ example: '14:30' }) @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time: string;
  @ApiPropertyOptional({ description: 'Encaixe: ignora jornada e sobreposição' }) @IsOptional() @IsBoolean() fitIn?: boolean;
  @ApiPropertyOptional({ description: 'Duração total manual (min)' }) @IsOptional() @IsInt() @Min(5) @Max(600) durationMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) internalNotes?: string;
  @ApiPropertyOptional({ enum: AppointmentStatus }) @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @ApiPropertyOptional({ type: RecurrenceDto }) @IsOptional() @ValidateNested() @Type(() => RecurrenceDto) recurrence?: RecurrenceDto;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() professionalId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientId?: string | null;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() serviceIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() fitIn?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(600) durationMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) internalNotes?: string;
  @ApiPropertyOptional({ description: 'Aplicar também aos próximos da recorrência' }) @IsOptional() @IsBoolean() applyToSeries?: boolean;
}

export class ChangeStatusDto {
  @ApiProperty({ enum: AppointmentStatus }) @IsEnum(AppointmentStatus) status: AppointmentStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @ApiPropertyOptional({ description: 'Cancelar toda a série recorrente' }) @IsOptional() @IsBoolean() cancelSeries?: boolean;
}

export class AvailabilityQuery {
  @ApiProperty({ example: '2026-10-20' }) date: string;
  @ApiPropertyOptional() professionalId?: string;
  @ApiPropertyOptional({ description: 'IDs separados por vírgula' }) serviceIds?: string;
  @ApiPropertyOptional() durationMinutes?: string;
}
