import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
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
import { OnboardingVerificationModule } from './onboarding-verification.module';
import { PassportHmacService } from './security/passport-hmac.service';
import { StudentMatchingService } from './student-matching/student-matching.service';

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
    expect(moduleRef.get(OnboardingController)).toBeDefined();
    expect(moduleRef.get(IssuerOnboardingRequestRepository)).toBeDefined();
    expect(moduleRef.get(IssuerReviewService)).toBeDefined();
    expect(moduleRef.get(IssuerReviewController)).toBeDefined();
  });
});
