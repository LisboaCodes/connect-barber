import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterClientDto,
  RegisterTenantDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './auth.dto';
import { AuthService } from './auth.service';

const meta = (req: Request) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Cadastra a barbearia e o dono (30 dias grátis)' })
  register(@Body() dto: RegisterTenantDto, @Req() req: Request) {
    return this.auth.registerTenant(dto, meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register-client')
  @ApiOperation({ summary: 'Cadastra um cliente final (para agendar online)' })
  registerClient(@Body() dto: RegisterClientDto, @Req() req: Request) {
    return this.auth.registerClient(dto, meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, meta(req));
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, meta(req));
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: Partial<RefreshDto>, @CurrentUser() user?: AuthUser) {
    return this.auth.logout(dto?.refreshToken, user?.sub);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @ApiBearerAuth()
  @Patch('me')
  updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(userId, dto);
  }

  @ApiBearerAuth()
  @Post('change-password')
  changePassword(@CurrentUser('sub') userId: string, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(userId, dto);
  }

  @ApiBearerAuth()
  @Post('switch/:tenantId')
  @ApiOperation({ summary: 'Troca a barbearia ativa (gera novos tokens)' })
  switchTenant(@CurrentUser('sub') userId: string, @Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.auth.switchTenant(userId, tenantId, meta(req));
  }
}
