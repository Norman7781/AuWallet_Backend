import { Module } from '@nestjs/common';

import { AuthenticatedUserService } from './authenticated-user.service';
import { HolderAccountModule } from '../holder-account/holder-account.module';
import { RolesModule } from '../roles/roles.module';
import { SupabaseModule } from '../../supabase/supabase.module';

@Module({
  imports: [SupabaseModule, HolderAccountModule, RolesModule],
  providers: [AuthenticatedUserService],
  exports: [AuthenticatedUserService],
})
export class UsersModule {}
