import { Module } from '@nestjs/common';
import { HolderAccountService } from './holder-account.service';
import { SupabaseModule } from '../../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [HolderAccountService],
  exports: [HolderAccountService],
})
export class HolderAccountModule {}
