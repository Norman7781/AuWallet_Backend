import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
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
import { OnboardingVerificationModule } from './onboarding-verification.module';
import { PassportHmacService } from './security/passport-hmac.service';
import { StudentMatchingService } from './student-matching/student-matching.service';
import { IssuerConnectionController } from './issuer-connections/issuer-connection.controller';
import { IssuerConnectionService } from './issuer-connections/issuer-connection.service';
import { IssuerProviderController } from './issuer-connections/issuer-provider.controller';
import { IssuerDashboardController } from './issuer-dashboard/issuer-dashboard.controller';
import { IssuerDashboardRepository } from './issuer-dashboard/issuer-dashboard.repository';
import { IssuerDashboardService } from './issuer-dashboard/issuer-dashboard.service';
import { IssuerAcademicController } from './issuer-academic/issuer-academic.controller';
import { IssuerAcademicRepository } from './issuer-academic/issuer-academic.repository';
import { IssuerAcademicService } from './issuer-academic/issuer-academic.service';

describe('OnboardingVerificationModule', () => {
  it('compiles with Member 2 providers and no database calls', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OnboardingVerificationModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest
          .fn()
          .mockReturnValue('synthetic-module-test-secret-with-32-plus-bytes'),
      })
      .overrideProvider(SupabaseService)
      .useValue({})
      .compile();

    expect(moduleRef.get(PassportHmacService)).toBeDefined();
    expect(moduleRef.get(StudentMatchingService)).toBeDefined();
    expect(moduleRef.get(OnboardingRequestRepository)).toBeDefined();
    expect(moduleRef.get(OnboardingService)).toBeDefined();
    expect(moduleRef.get(OnboardingApprovalFinalizer)).toBeInstanceOf(
      SupabaseOnboardingApprovalFinalizer,
    );
    expect(moduleRef.get(OnboardingRejectionFinalizer)).toBeInstanceOf(
      SupabaseOnboardingRejectionFinalizer,
    );
    expect(moduleRef.get(IssuerConnectionService)).toBeDefined();
    expect(moduleRef.get(IssuerProviderController)).toBeDefined();
    expect(moduleRef.get(IssuerConnectionController)).toBeDefined();
    expect(moduleRef.get(IssuerDashboardRepository)).toBeDefined();
    expect(moduleRef.get(IssuerDashboardService)).toBeDefined();
    expect(moduleRef.get(IssuerDashboardController)).toBeDefined();
    expect(moduleRef.get(IssuerAcademicRepository)).toBeDefined();
    expect(moduleRef.get(IssuerAcademicService)).toBeDefined();
    expect(moduleRef.get(IssuerAcademicController)).toBeDefined();
    expect(moduleRef.get(IssuerOnboardingRequestRepository)).toBeDefined();
    expect(moduleRef.get(IssuerReviewService)).toBeDefined();
    expect(moduleRef.get(IssuerReviewController)).toBeDefined();
  });
});
