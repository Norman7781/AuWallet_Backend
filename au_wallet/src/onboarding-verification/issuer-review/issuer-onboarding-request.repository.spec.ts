import { InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { IssuerOnboardingRequestRepository } from './issuer-onboarding-request.repository';

function createQuery(result: unknown) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    range: jest.fn(),
    maybeSingle: jest.fn(),
    update: jest.fn(),
    overrideTypes: jest.fn().mockResolvedValue(result),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);
  query.maybeSingle.mockReturnValue(query);
  query.update.mockReturnValue(query);

  return query;
}

function createRepository(result: unknown) {
  const query = createQuery(result);
  const from = jest.fn().mockReturnValue(query);
  const schema = jest.fn().mockReturnValue({ from });
  const repository = new IssuerOnboardingRequestRepository({
    schema,
  } as unknown as SupabaseService);

  return { repository, query, from, schema };
}

const row = {
  onboarding_request_id: 101,
  holder_account_id: 12,
  admission_no: 'DEMO-STU-0001',
  date_of_birth: '2001-02-03',
  verification_status: 'under_review',
  matched_enrollment_id: 55,
  reviewed_at: null,
  rejection_reason: null,
  submitted_at: '2026-08-04T10:00:00.000Z',
};

describe('IssuerOnboardingRequestRepository', () => {
  it('lists only under-review requests without selecting passport HMAC values', async () => {
    const { repository, query, schema, from } = createRepository({
      data: [row],
      error: null,
      count: 1,
    });

    const result = await repository.listUnderReview(2, 20);

    expect(schema).toHaveBeenCalledWith('wallet');
    expect(from).toHaveBeenCalledWith('wallet_onboarding_request');
    expect(query.select).toHaveBeenCalledWith(
      expect.not.stringContaining('passport_number_hmac'),
      { count: 'exact' },
    );
    expect(query.select).toHaveBeenCalledWith(
      expect.not.stringContaining('reviewed_by'),
      { count: 'exact' },
    );
    expect(query.eq).toHaveBeenCalledWith(
      'verification_status',
      'under_review',
    );
    expect(query.range).toHaveBeenCalledWith(20, 39);
    expect(result.total).toBe(1);
    expect(result.records[0]).not.toHaveProperty('passportNumberHmac');
  });

  it('loads one safe issuer request by ID', async () => {
    const { repository, query } = createRepository({
      data: row,
      error: null,
    });

    await expect(repository.findById(101)).resolves.toEqual({
      onboardingRequestId: 101,
      holderAccountId: 12,
      admissionNo: 'DEMO-STU-0001',
      dateOfBirth: '2001-02-03',
      verificationStatus: 'under_review',
      matchedEnrollmentId: 55,
      reviewedAt: null,
      rejectionReason: null,
      submittedAt: '2026-08-04T10:00:00.000Z',
    });
    expect(query.eq).toHaveBeenCalledWith('onboarding_request_id', 101);
  });

  it('does not convert database errors into an empty queue', async () => {
    const { repository } = createRepository({
      data: null,
      error: { code: 'DATABASE_UNAVAILABLE' },
      count: null,
    });

    await expect(repository.listUnderReview(1, 20)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
