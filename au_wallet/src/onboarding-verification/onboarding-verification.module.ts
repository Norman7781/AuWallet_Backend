import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthHolderAccountModule } from '../auth-holder-account/auth-holder-account.module';
import { UsersModule } from '../auth-holder-account/users/users.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { IssuerOnboardingRequestRepository } from './issuer-review/issuer-onboarding-request.repository';
import { IssuerReviewController } from './issuer-review/issuer-review.controller';
import { IssuerReviewService } from './issuer-review/issuer-review.service';
import { OnboardingController } from './onboarding/onboarding.controller';
import { OnboardingRequestRepository } from './onboarding/onboarding-request.repository';
import { OnboardingService } from './onboarding/onboarding.service';
import {
  OnboardingApprovalFinalizer,
  SupabaseOnboardingApprovalFinalizer,
} from './onboarding/verified-onboarding-finalizer';
import { PassportHmacService } from './security/passport-hmac.service';
import { AcademicStudentRepository } from './student-matching/academic-student.repository';
import { StudentMatchingService } from './student-matching/student-matching.service';

@Module({
  imports: [AuthHolderAccountModule, UsersModule, ConfigModule, SupabaseModule],
  controllers: [IssuerReviewController, OnboardingController],
  providers: [
    PassportHmacService,
    AcademicStudentRepository,
    StudentMatchingService,
    IssuerOnboardingRequestRepository,
    IssuerReviewService,
    OnboardingRequestRepository,
    OnboardingService,
    {
      provide: OnboardingApprovalFinalizer,
      useClass: SupabaseOnboardingApprovalFinalizer,
    },
  ],
  exports: [OnboardingService, PassportHmacService, StudentMatchingService],
})
export class OnboardingVerificationModule {}
