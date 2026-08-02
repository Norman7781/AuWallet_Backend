import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { HolderAccountModule } from './holder-account/holder-account.module';

@Module({
  imports: [AuthModule, HolderAccountModule],
  exports: [AuthModule],
})
export class AuthHolderAccountModule {}
