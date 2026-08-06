import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthHolderAccountModule } from './auth-holder-account/auth-holder-account.module';
import { validateEnvironment } from './config/environment';
import { OnboardingVerificationModule } from './onboarding-verification/onboarding-verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),

    AuthHolderAccountModule,
    OnboardingVerificationModule,
  ],
})
export class AppModule {}
