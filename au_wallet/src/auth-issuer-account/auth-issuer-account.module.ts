// src/auth-issuer-account/auth-issuer-account.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthIssuerAccountController } from './auth-issuer-account.controller';
import { AuthIssuerAccountService } from './auth-issuer-account.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    PassportModule,
    SupabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthIssuerAccountController],
  providers: [AuthIssuerAccountService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthIssuerAccountModule {}