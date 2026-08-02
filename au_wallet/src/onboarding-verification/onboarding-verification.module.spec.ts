import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
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
        get: jest.fn().mockReturnValue('synthetic-module-test-secret'),
      })
      .overrideProvider(SupabaseService)
      .useValue({})
      .compile();

    expect(moduleRef.get(PassportHmacService)).toBeDefined();
    expect(moduleRef.get(StudentMatchingService)).toBeDefined();
  });
});
