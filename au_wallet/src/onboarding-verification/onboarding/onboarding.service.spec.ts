import { ConflictException, NotFoundException } from '@nestjs/common';
import { StudentMatchingService } from '../student-matching/student-matching.service';
import { CreateOnboardingRequestDto } from './dto/create-onboarding-request.dto';
import { OnboardingRequestRecord } from './onboarding-request.interface';
import { OnboardingRequestRepository } from './onboarding-request.repository';
import { OnboardingService } from './onboarding.service';

const dto: CreateOnboardingRequestDto = {
  admissionNo: ' DEMO-STU-0001 ',
  dateOfBirth: ' 2001-02-03 ',
  passportNumber: 'synthetic-passport-input',
};

function record(
  verificationStatus: OnboardingRequestRecord['verificationStatus'],
  matchedEnrollmentId: number | null = null,
): OnboardingRequestRecord {
  return {
    onboardingRequestId: 101,
    holderAccountId: 12,
    verificationStatus,
    matchedEnrollmentId,
    rejectionReason:
      verificationStatus === 'rejected'
        ? 'ONBOARDING_REQUIREMENTS_NOT_MET'
        : null,
    reviewedAt: null,
    submittedAt: '2026-08-04T10:00:00.000Z',
  };
}

function createService() {
  const findLatestByHolderAccountId = jest.fn();
  const createRequest = jest.fn();
  const prepareAndMatch = jest.fn();
  const service = new OnboardingService(
    {
      findLatestByHolderAccountId,
      createRequest,
    } as unknown as OnboardingRequestRepository,
    { prepareAndMatch } as unknown as StudentMatchingService,
  );

  return {
    service,
    findLatestByHolderAccountId,
    createRequest,
    prepareAndMatch,
  };
}

describe('OnboardingService', () => {
  it.each([
    ['current student', 'studying'],
    ['alumnus', 'alumni'],
  ] as const)(
    '%s: exact eligible match stops at under_review and stores only the internal candidate',
    async (_scenario, academicStatus) => {
      const dependencies = createService();
      dependencies.findLatestByHolderAccountId.mockResolvedValue(null);
      dependencies.prepareAndMatch.mockResolvedValue({
        passportNumberHmac: 'synthetic-protected-value',
        result: {
          outcome: 'matched',
          studentId: 44,
          enrollmentId: 55,
          academicStatus,
        },
      });
      dependencies.createRequest.mockResolvedValue(record('under_review', 55));

      const response = await dependencies.service.submit(12, dto);

      expect(dependencies.createRequest).toHaveBeenCalledWith({
        holderAccountId: 12,
        admissionNo: 'DEMO-STU-0001',
        dateOfBirth: '2001-02-03',
        passportNumberHmac: 'synthetic-protected-value',
        verificationStatus: 'under_review',
        matchedEnrollmentId: 55,
        rejectionReason: null,
      });
      expect(response.data.verificationStatus).toBe('under_review');
      expect(response.data).not.toHaveProperty('matchedEnrollmentId');
      expect(response.data).not.toHaveProperty('passportNumber');
      expect(response.data).not.toHaveProperty('passportNumberHmac');
      expect(response.data).not.toHaveProperty('officialGraduationDate');
    },
  );

  it('exact match does not activate during submission', async () => {
    const dependencies = createService();
    dependencies.findLatestByHolderAccountId.mockResolvedValue(null);
    dependencies.prepareAndMatch.mockResolvedValue({
      passportNumberHmac: 'synthetic-protected-value',
      result: {
        outcome: 'matched',
        studentId: 44,
        enrollmentId: 55,
        academicStatus: 'studying',
      },
    });
    dependencies.createRequest.mockResolvedValue(record('under_review', 55));

    const response = await dependencies.service.submit(12, dto);

    expect(response.data.verificationStatus).toBe('under_review');
    expect(dependencies.createRequest).toHaveBeenCalledTimes(1);
  });

  it('mismatch becomes under_review without a candidate and reveals no match detail', async () => {
    const dependencies = createService();
    dependencies.findLatestByHolderAccountId.mockResolvedValue(null);
    dependencies.prepareAndMatch.mockResolvedValue({
      passportNumberHmac: 'synthetic-protected-value',
      result: { outcome: 'under_review', reason: 'no_exact_match' },
    });
    dependencies.createRequest.mockResolvedValue(record('under_review'));

    const result = await dependencies.service.submit(12, dto);

    expect(dependencies.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationStatus: 'under_review',
        matchedEnrollmentId: null,
      }),
    );
    expect(result.message).toBe(
      'Onboarding request submitted for issuer review.',
    );
    expect(result).not.toHaveProperty('reason');
  });

  it('ineligible enrollment is rejected and has no approvable candidate', async () => {
    const dependencies = createService();
    dependencies.findLatestByHolderAccountId.mockResolvedValue(null);
    dependencies.prepareAndMatch.mockResolvedValue({
      passportNumberHmac: 'synthetic-protected-value',
      result: {
        outcome: 'ineligible',
        studentId: 44,
        enrollmentId: 55,
        academicStatus: 'withdrawn',
      },
    });
    dependencies.createRequest.mockResolvedValue(record('rejected'));

    const result = await dependencies.service.submit(12, dto);

    expect(dependencies.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationStatus: 'rejected',
        matchedEnrollmentId: null,
        rejectionReason: 'ONBOARDING_REQUIREMENTS_NOT_MET',
      }),
    );
    expect(result.data.verificationStatus).toBe('rejected');
  });

  it.each(['submitted', 'under_review', 'matched'] as const)(
    'duplicate/concurrent submission conflict while latest request is %s',
    async (verificationStatus) => {
      const dependencies = createService();
      dependencies.findLatestByHolderAccountId.mockResolvedValue(
        record(verificationStatus),
      );

      await expect(dependencies.service.submit(12, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(dependencies.prepareAndMatch).not.toHaveBeenCalled();
    },
  );

  it('corrected resubmission after rejection creates a new under-review candidate', async () => {
    const dependencies = createService();
    dependencies.findLatestByHolderAccountId.mockResolvedValue(
      record('rejected'),
    );
    dependencies.prepareAndMatch.mockResolvedValue({
      passportNumberHmac: 'synthetic-protected-value',
      result: {
        outcome: 'matched',
        studentId: 44,
        enrollmentId: 55,
        academicStatus: 'studying',
      },
    });
    dependencies.createRequest.mockResolvedValue(record('under_review', 55));

    await expect(dependencies.service.submit(12, dto)).resolves.toMatchObject({
      data: { verificationStatus: 'under_review' },
    });
    expect(dependencies.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ matchedEnrollmentId: 55 }),
    );
  });

  it('returns only the authenticated holder current request status', async () => {
    const dependencies = createService();
    dependencies.findLatestByHolderAccountId.mockResolvedValue(
      record('under_review', 55),
    );

    const response = await dependencies.service.getMine(12);

    expect(dependencies.findLatestByHolderAccountId).toHaveBeenCalledWith(12);
    expect(response.data.verificationStatus).toBe('under_review');
    expect(response.data).not.toHaveProperty('holderAccountId');
    expect(response.data).not.toHaveProperty('matchedEnrollmentId');
  });

  it('returns not found when the holder has no request', async () => {
    const dependencies = createService();
    dependencies.findLatestByHolderAccountId.mockResolvedValue(null);

    await expect(dependencies.service.getMine(12)).rejects.toThrow(
      NotFoundException,
    );
  });
});
