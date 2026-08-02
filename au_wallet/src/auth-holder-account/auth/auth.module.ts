import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { HolderAccountModule } from '../holder-account/holder-account.module';
import { RolesModule } from '../roles/roles.module';
import { LoginHistoryModule } from '../login-history/login-history.module';
import { UsersModule } from '../users/users.module';
import { SupabaseModule } from '../../supabase/supabase.module';
import { HolderAccountController } from '../holder-account/holder-account.controller';
import { RolesController } from '../roles/roles.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    SupabaseModule,
    HolderAccountModule,
    RolesModule,
    LoginHistoryModule,
    UsersModule,
  ],
  controllers: [AuthController, HolderAccountController, RolesController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
