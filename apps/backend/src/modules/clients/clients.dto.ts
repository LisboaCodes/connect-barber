import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClientDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional({ example: '1990-05-20' }) @IsOptional() @IsDateString() birthDate?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() gender?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() document?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() preferredProfessionalId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() clubId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() blocked?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() marketingOptIn?: boolean;
}

export class UpdateClientDto extends CreateClientDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name: string;
}

export class ImportClientsDto {
  @ApiProperty({ type: [CreateClientDto] }) @IsArray() items: CreateClientDto[];
}
