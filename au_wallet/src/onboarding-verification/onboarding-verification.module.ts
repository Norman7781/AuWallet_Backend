import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthHolderAccountModule } from '../auth-holder-account/auth-holder-account.module';
import { UsersModule } from '../auth-holder-account/users/users.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { IssuerOnboardingRequestRepository } from './issuer-review/issuer-onboarding-request.repository';
import { IssuerReviewController } from './issuer-review/issuer-review.controller';
import { IssuerReviewService } from './issuer-review/issuer-review.service';
import { OnboardingRequestRepository } from './onboarding/onboarding-request.repository';
import { OnboardingService } from './onboarding/onboarding.service';
import {
  OnboardingApprovalFinalizer,
  OnboardingRejectionFinalizer,
  SupabaseOnboardingApprovalFinalizer,
  SupabaseOnboardingRejectionFinalizer,
} from './onboarding/verified-onboarding-finalizer';
import { PassportHmacService } from './security/passport-hmac.service';
import { AcademicStudentRepository } from './student-matching/academic-student.repository';
import { StudentMatchingService } from './student-matching/student-matching.service';
import { HolderIssuerConnectionRepository } from './issuer-connections/holder-issuer-connection.repository';
import { IssuerConnectionController } from './issuer-connections/issuer-connection.controller';
import { IssuerConnectionService } from './issuer-connections/issuer-connection.service';
import { IssuerProviderController } from './issuer-connections/issuer-provider.controller';
import { IssuerProviderRepository } from './issuer-connections/issuer-provider.repository';
import { IssuerDashboardController } from './issuer-dashboard/issuer-dashboard.controller';
import { IssuerDashboardRepository } from './issuer-dashboard/issuer-dashboard.repository';
import { IssuerDashboardService } from './issuer-dashboard/issuer-dashboard.service';
import { NonProductionDashboardGuard } from './issuer-dashboard/non-production-dashboard.guard';
import { IssuerAcademicController } from './issuer-academic/issuer-academic.controller';
import { IssuerAcademicRepository } from './issuer-academic/issuer-academic.repository';
import { IssuerAcademicService } from './issuer-academic/issuer-academic.service';

@Module({
  imports: [AuthHolderAccountModule, UsersModule, ConfigModule, SupabaseModule],
  controllers: [
    IssuerReviewController,
    IssuerProviderController,
    IssuerConnectionController,
    IssuerDashboardController,
    IssuerAcademicController,
  ],
  providers: [
    PassportHmacService,
    AcademicStudentRepository,
    StudentMatchingService,
    IssuerOnboardingRequestRepository,
    IssuerReviewService,
    OnboardingRequestRepository,
    OnboardingService,
    IssuerProviderRepository,
    HolderIssuerConnectionRepository,
    IssuerConnectionService,
    IssuerDashboardRepository,
    IssuerDashboardService,
    IssuerAcademicRepository,
    IssuerAcademicService,
    NonProductionDashboardGuard,
    {
      provide: OnboardingApprovalFinalizer,
      useClass: SupabaseOnboardingApprovalFinalizer,
    },
    {
      provide: OnboardingRejectionFinalizer,
      useClass: SupabaseOnboardingRejectionFinalizer,
    },
  ],
  exports: [
    OnboardingService,
    IssuerConnectionService,
    PassportHmacService,
    StudentMatchingService,
  ],
})
export class OnboardingVerificationModule {}
