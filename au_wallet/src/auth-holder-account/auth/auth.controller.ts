import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { CurrentAccessToken } from '../common/decorators/current-access-token.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(
      dto,
      request.ip,
      request.headers['user-agent'],
    );
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('resend-confirmation')
  resendConfirmation(@Body() dto: ForgotPasswordDto) {
    return this.authService.resendConfirmation(dto.email);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshSessionDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(
    @CurrentAccessToken() accessToken: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.authService.logout(
      accessToken,
      user.supabaseAuthId,
      request.ip,
      request.headers['user-agent'],
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return { data: user };
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  updatePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.authService.updatePassword(user.supabaseAuthId, dto.password);
  }
}
