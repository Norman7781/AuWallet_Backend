import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthHolderAccountModule } from './auth-holder-account/auth-holder-account.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnvironment } from './config/environment';
import { OnboardingVerificationModule } from './onboarding-verification/onboarding-verification.module';
import { VcModule } from './VC_Management/Vc_module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),

    AuthHolderAccountModule,
    OnboardingVerificationModule,
    VcModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
