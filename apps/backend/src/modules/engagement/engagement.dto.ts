import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageChannel } from '@prisma/client';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CampaignDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) title: string;
  @ApiProperty({ description: 'Texto da mensagem; aceita {{cliente}}, {{barbearia}}, {{link}}' }) @IsString() @MinLength(5) @MaxLength(2000) content: string;
  @ApiProperty({ enum: MessageChannel, isArray: true }) @IsArray() @IsEnum(MessageChannel, { each: true }) channels: MessageChannel[];
  @ApiPropertyOptional({ description: '{"all":true} | {"tags":["vip"],"clubId":"..","inactiveDays":30,"birthdayMonth":5,"professionalId":".."}' })
  @IsOptional() @IsObject() audience?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledAt?: string | null;
}

export class WaitlistDto {
  @ApiPropertyOptional() @IsOptional() @IsString() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientPhone?: string;
  @ApiProperty({ example: '2026-10-25' }) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @ApiPropertyOptional() @IsOptional() @IsString() professionalId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string | null;
  @ApiPropertyOptional({ example: '09:00' }) @IsOptional() @IsString() periodStart?: string;
  @ApiPropertyOptional({ example: '12:00' }) @IsOptional() @IsString() periodEnd?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

export class ReturnRuleDto {
  @ApiPropertyOptional({ description: 'Nulo = todos os serviços' }) @IsOptional() @IsString() serviceId?: string | null;
  @ApiProperty({ example: 30 }) @IsInt() @Min(1) @Max(365) daysAfter: number;
  @ApiProperty({ description: 'Aceita {{cliente}}, {{barbearia}}, {{servico}}, {{link}}' }) @IsString() @MinLength(5) @MaxLength(1000) message: string;
  @ApiPropertyOptional({ enum: MessageChannel, isArray: true }) @IsOptional() @IsArray() @IsEnum(MessageChannel, { each: true }) channels?: MessageChannel[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SurveyAnswerDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
