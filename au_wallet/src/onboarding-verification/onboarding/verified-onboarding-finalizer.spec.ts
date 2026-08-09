import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  SupabaseOnboardingApprovalFinalizer,
  SupabaseOnboardingRejectionFinalizer,
} from './verified-onboarding-finalizer';

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
  holder_issuer_connection_id: 22,
  issuer_code: 'assumption-university',
  connection_status: 'verified',
  verification_status: 'matched',
  matched_enrollment_id: 55,
  rejection_reason: null,
  reviewed_at: '2026-08-05T12:00:00.000Z',
  submitted_at: '2026-08-05T11:00:00.000Z',
  verified_at: '2026-08-05T12:00:00.000Z',
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
      holderIssuerConnectionId: 22,
      issuerCode: 'assumption-university',
      connectionStatus: 'verified',
      verificationStatus: 'matched',
      matchedEnrollmentId: 55,
      rejectionReason: null,
      reviewedAt: '2026-08-05T12:00:00.000Z',
      submittedAt: '2026-08-05T11:00:00.000Z',
      verifiedAt: '2026-08-05T12:00:00.000Z',
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
          code: 'ISSUER_VERIFICATION_NOT_APPROVABLE',
          message: 'This issuer verification cannot be approved.',
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

describe('SupabaseOnboardingRejectionFinalizer', () => {
  it('uses the atomic connection-aware rejection RPC', async () => {
    const rejectedRow = {
      ...approvedRow,
      connection_status: 'rejected',
      verification_status: 'rejected',
      rejection_reason: 'IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED',
      verified_at: null,
    };
    const single = jest.fn().mockResolvedValue({
      data: rejectedRow,
      error: null,
    });
    const rpc = jest.fn().mockReturnValue({ single });
    const finalizer = new SupabaseOnboardingRejectionFinalizer({
      schema: jest.fn().mockReturnValue({ rpc }),
    } as unknown as SupabaseService);

    await expect(
      finalizer.reject({
        onboardingRequestId: 101,
        reviewedBy: '00000000-0000-4000-8000-000000000002',
        rejectionReason: 'IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED',
      }),
    ).resolves.toMatchObject({
      holderIssuerConnectionId: 22,
      connectionStatus: 'rejected',
      verificationStatus: 'rejected',
      verifiedAt: null,
    });
    expect(rpc).toHaveBeenCalledWith('reject_issuer_verification_request', {
      p_onboarding_request_id: 101,
      p_reviewed_by: '00000000-0000-4000-8000-000000000002',
      p_rejection_reason: 'IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED',
    });
  });
});
