import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import { RoleAdminService } from './role-admin.service';
import { RoleService } from './role.service';

@Module({
  imports: [SupabaseModule],
  providers: [RoleService, RoleAdminService],
  exports: [RoleService, RoleAdminService],
})
export class RolesModule {}
