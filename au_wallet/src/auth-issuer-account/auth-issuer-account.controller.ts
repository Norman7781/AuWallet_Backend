// src/auth-issuer-account/auth-issuer-account.controller.ts
import { Body, Controller, Post, HttpCode, Get, UseGuards, Req } from '@nestjs/common';
import { AuthIssuerAccountService } from './auth-issuer-account.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth/issuer')
export class AuthIssuerAccountController {
  constructor(private readonly authService: AuthIssuerAccountService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.validateLogin(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req) {
    // req.user comes from JwtStrategy.validate()
    return req.user;
  }
}