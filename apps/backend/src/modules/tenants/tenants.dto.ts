import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateTenantDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(60) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() legalName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() document?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() whatsapp?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() coverUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() addressStreet?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressComplement?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressDistrict?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressCity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressState?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressZip?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() longitude?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() siteEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) siteAbout?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() siteGallery?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() siteInstagram?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteFacebook?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sitePaymentInfo?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() onlineBookingEnabled?: boolean;

  @ApiPropertyOptional({ description: '{"1":[{"start":"09:00","end":"18:00"}],...}' })
  @IsOptional() @IsObject() openingHours?: Record<string, { start: string; end: string }[]>;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(120) slotIntervalMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) minAdvanceMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(365) maxAdvanceDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) cancelLimitHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoConfirm?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requirePrepayment?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() reminderEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(168) reminderHoursBefore?: number;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() reminderChannels?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() birthdayMessageEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() birthdayMessage?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() surveyEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsObject() settings?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(9) onboardingStep?: number;
}

export class CreateMemberDto {
  @ApiProperty() @IsString() @MinLength(2) name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional({ description: 'Senha inicial; se omitida, uma será gerada e retornada' })
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @ApiProperty({ enum: MemberRole }) @IsEnum(MemberRole) role: MemberRole;
  @ApiPropertyOptional({ description: 'Vincular a um profissional já cadastrado' })
  @IsOptional() @IsString() professionalId?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() permissions?: Record<string, boolean>;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: MemberRole }) @IsOptional() @IsEnum(MemberRole) role?: MemberRole;
  @ApiPropertyOptional() @IsOptional() @IsObject() permissions?: Record<string, boolean>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() professionalId?: string | null;
  @ApiPropertyOptional({ description: 'Redefinir senha do membro' }) @IsOptional() @IsString() @MinLength(6) password?: string;
}

export class PaymentMethodConfigDto {
  @ApiProperty() @IsString() method: string;
  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) feePct?: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() installmentFees?: Record<string, number>;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(24) maxInstallments?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PaymentMethodsDto {
  @ApiProperty({ type: [PaymentMethodConfigDto] })
  @IsArray() @Type(() => PaymentMethodConfigDto) items: PaymentMethodConfigDto[];
}
