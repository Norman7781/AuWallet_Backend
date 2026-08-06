import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { SupabaseOnboardingApprovalFinalizer } from './verified-onboarding-finalizer';

function createFinalizer(result: unknown) {
  const single = jest.fn().mockResolvedValue(result);
  const rpc = jest.fn().mockReturnValue({ single });
  const schema = jest.fn().mockReturnValue({ rpc });
  const finalizer = new SupabaseOnboardingApprovalFinalizer({
    schema,
  } as unknown as SupabaseService);

  return { finalizer, rpc, schema };
}

const approvedRow = {
  onboarding_request_id: 101,
  holder_account_id: 12,
  verification_status: 'matched',
  matched_enrollment_id: 55,
  rejection_reason: null,
  reviewed_at: '2026-08-05T12:00:00.000Z',
  submitted_at: '2026-08-05T11:00:00.000Z',
};

describe('SupabaseOnboardingApprovalFinalizer', () => {
  it('uses the typed backend-only approval RPC and maps its safe result', async () => {
    const { finalizer, rpc, schema } = createFinalizer({
      data: approvedRow,
      error: null,
    });

    await expect(
      finalizer.approve({
        onboardingRequestId: 101,
        reviewedBy: '00000000-0000-4000-8000-000000000002',
      }),
    ).resolves.toEqual({
      onboardingRequestId: 101,
      holderAccountId: 12,
      verificationStatus: 'matched',
      matchedEnrollmentId: 55,
      rejectionReason: null,
      reviewedAt: '2026-08-05T12:00:00.000Z',
      submittedAt: '2026-08-05T11:00:00.000Z',
    });
    expect(schema).toHaveBeenCalledWith('wallet');
    expect(rpc).toHaveBeenCalledWith('approve_onboarding_request', {
      p_onboarding_request_id: 101,
      p_reviewed_by: '00000000-0000-4000-8000-000000000002',
    });
  });

  it.each(['P0001', '22023', '40001'])(
    'maps expected database rejection %s to a stable safe conflict',
    async (code) => {
      const { finalizer } = createFinalizer({ data: null, error: { code } });

      await expect(
        finalizer.approve({
          onboardingRequestId: 101,
          reviewedBy: '00000000-0000-4000-8000-000000000002',
        }),
      ).rejects.toMatchObject({
        constructor: ConflictException,
        response: {
          code: 'REVIEW_NOT_APPROVABLE',
          message: 'This onboarding request cannot be approved.',
        },
      });
    },
  );

  it('hides unexpected database details behind an internal error', async () => {
    const { finalizer } = createFinalizer({
      data: null,
      error: { code: 'DATABASE_FAILURE', message: 'unsafe detail' },
    });

    await expect(
      finalizer.approve({
        onboardingRequestId: 101,
        reviewedBy: '00000000-0000-4000-8000-000000000002',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
