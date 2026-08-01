import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthHolderAccountModule } from './auth-holder-account/auth-holder-account.module';
import { validateEnvironment } from './config/environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),

    AuthHolderAccountModule,
  ],
})
export class AppModule {}
