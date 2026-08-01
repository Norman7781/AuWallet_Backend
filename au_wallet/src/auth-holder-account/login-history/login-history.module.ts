import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import { LoginHistoryService } from './login-history.service';

@Module({
  imports: [SupabaseModule],
  providers: [LoginHistoryService],
  exports: [LoginHistoryService],
})
export class LoginHistoryModule {}
