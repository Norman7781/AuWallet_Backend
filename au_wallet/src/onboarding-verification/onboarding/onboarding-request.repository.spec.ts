import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { OnboardingRequestRepository } from './onboarding-request.repository';

function createQuery(result: unknown) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn(),
    insert: jest.fn(),
    single: jest.fn(),
    overrideTypes: jest.fn().mockResolvedValue(result),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.maybeSingle.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.single.mockReturnValue(query);

  return query;
}

function createRepository(result: unknown) {
  const query = createQuery(result);
  const from = jest.fn().mockReturnValue(query);
  const schema = jest.fn().mockReturnValue({ from });
  const repository = new OnboardingRequestRepository({
    schema,
  } as unknown as SupabaseService);

  return { repository, query, from, schema };
}

const row = {
  onboarding_request_id: 101,
  holder_account_id: 12,
  holder_issuer_connection_id: 22,
  verification_status: 'under_review',
  matched_enrollment_id: 55,
  rejection_reason: null,
  reviewed_at: null,
  submitted_at: '2026-08-04T10:00:00.000Z',
};

describe('OnboardingRequestRepository', () => {
  it('loads only safe status fields for the authenticated holder/provider connection', async () => {
    const { repository, query, from, schema } = createRepository({
      data: row,
      error: null,
    });

    await expect(repository.findLatestByConnectionId(22)).resolves.toEqual({
      onboardingRequestId: 101,
      holderAccountId: 12,
      holderIssuerConnectionId: 22,
      verificationStatus: 'under_review',
      matchedEnrollmentId: 55,
      rejectionReason: null,
      reviewedAt: null,
      submittedAt: '2026-08-04T10:00:00.000Z',
    });
    expect(schema).toHaveBeenCalledWith('wallet');
    expect(from).toHaveBeenCalledWith('wallet_onboarding_request');
    expect(query.eq).toHaveBeenCalledWith('holder_issuer_connection_id', 22);
    expect(query.select).toHaveBeenCalledWith(
      expect.not.stringContaining('passport_number_hmac'),
    );
  });

  it('returns null when the connection has no verification request', async () => {
    const { repository } = createRepository({ data: null, error: null });

    await expect(repository.findLatestByConnectionId(22)).resolves.toBeNull();
  });

  it('stores the protected identity fields without returning the HMAC', async () => {
    const { repository, query } = createRepository({
      data: row,
      error: null,
    });
    const protectedHmac = 'synthetic-protected-value';

    const result = await repository.createRequest({
      holderAccountId: 12,
      holderIssuerConnectionId: 22,
      admissionNo: 'DEMO-STU-0001',
      dateOfBirth: '2001-02-03',
      passportNumberHmac: protectedHmac,
      verificationStatus: 'under_review',
      matchedEnrollmentId: 55,
      rejectionReason: null,
    });

    expect(query.insert).toHaveBeenCalledWith({
      holder_account_id: 12,
      holder_issuer_connection_id: 22,
      admission_no: 'DEMO-STU-0001',
      date_of_birth: '2001-02-03',
      passport_number_hmac: protectedHmac,
      verification_status: 'under_review',
      matched_enrollment_id: 55,
      rejection_reason: null,
    });
    expect(result).not.toHaveProperty('passportNumberHmac');
  });

  it('maps a uniqueness failure to a safe conflict', async () => {
    const { repository } = createRepository({
      data: null,
      error: { code: '23505' },
    });

    await expect(
      repository.createRequest({
        holderAccountId: 12,
        holderIssuerConnectionId: 22,
        admissionNo: 'DEMO-STU-0001',
        dateOfBirth: '2001-02-03',
        passportNumberHmac: 'synthetic-protected-value',
        verificationStatus: 'under_review',
        matchedEnrollmentId: null,
        rejectionReason: null,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('loads an active attempt scoped to one holder/provider connection', async () => {
    const { repository, query } = createRepository({ data: row, error: null });

    await expect(
      repository.findActiveByConnectionId(22),
    ).resolves.toMatchObject({
      holderIssuerConnectionId: 22,
      verificationStatus: 'under_review',
    });
    expect(query.eq).toHaveBeenCalledWith('holder_issuer_connection_id', 22);
    expect(query.in).toHaveBeenCalledWith('verification_status', [
      'submitted',
      'under_review',
    ]);
  });

  it('does not turn database failures into a verification result', async () => {
    const { repository } = createRepository({
      data: null,
      error: { code: 'DATABASE_UNAVAILABLE' },
    });

    await expect(repository.findLatestByConnectionId(22)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
