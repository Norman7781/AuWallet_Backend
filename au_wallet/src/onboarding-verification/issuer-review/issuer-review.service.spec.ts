import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AcademicReviewContext } from '../student-matching/academic-student-record.interface';
import { AcademicStudentRepository } from '../student-matching/academic-student.repository';
import { ListOnboardingRequestsDto } from './dto/list-onboarding-requests.dto';
import {
  IssuerRejectionReason,
  IssuerReviewDecision,
} from './dto/review-onboarding-request.dto';
import { IssuerOnboardingRequestRecord } from './issuer-onboarding-request.interface';
import { IssuerOnboardingRequestRepository } from './issuer-onboarding-request.repository';
import { IssuerReviewService } from './issuer-review.service';

function reviewRequest(
  verificationStatus: IssuerOnboardingRequestRecord['verificationStatus'] = 'under_review',
  matchedEnrollmentId: number | null = 55,
): IssuerOnboardingRequestRecord {
  return {
    onboardingRequestId: 101,
    holderAccountId: 12,
    admissionNo: 'DEMO-STU-0001',
    dateOfBirth: '2001-02-03',
    verificationStatus,
    matchedEnrollmentId,
    reviewedAt: null,
    rejectionReason: null,
    submittedAt: '2026-08-04T10:00:00.000Z',
  };
}

function academicContext(
  academicStatus: AcademicReviewContext['academicStatus'] = 'studying',
): AcademicReviewContext {
  return {
    enrollmentId: 55,
    studentName: 'Dr. Narin Example',
    admissionNo: 'DEMO-STU-0001',
    dateOfBirth: '2001-02-03',
    degreeName: 'Bachelor of Science',
    major: 'Computer Science',
    majorConcentration: null,
    admissionDate: '2023-06-01',
    academicStatus,
    officialGraduationDate:
      academicStatus === 'graduated' || academicStatus === 'alumni'
        ? '2026-05-20'
        : null,
  };
}

function createService() {
  const listUnderReview = jest.fn();
  const findById = jest.fn();
  const rejectUnderReview = jest.fn();
  const findReviewContexts = jest.fn();
  const approve = jest.fn();
  const service = new IssuerReviewService(
    {
      listUnderReview,
      findById,
      rejectUnderReview,
    } as unknown as IssuerOnboardingRequestRepository,
    { findReviewContexts } as unknown as AcademicStudentRepository,
    { approve },
  );

  return {
    service,
    listUnderReview,
    findById,
    rejectUnderReview,
    findReviewContexts,
    approve,
  };
}

describe('IssuerReviewService', () => {
  it('returns a paginated safe queue with canApprove and academic review fields', async () => {
    const dependencies = createService();
    dependencies.listUnderReview.mockResolvedValue({
      records: [reviewRequest()],
      total: 1,
    });
    dependencies.findReviewContexts.mockResolvedValue(
      new Map([[55, academicContext()]]),
    );
    const query = Object.assign(new ListOnboardingRequestsDto(), {
      page: 2,
      limit: 10,
    });

    const response = await dependencies.service.list(query);

    expect(response.meta).toEqual({ page: 2, limit: 10, total: 1 });
    expect(response.data[0]).toMatchObject({
      canApprove: true,
      systemMatch: 'exact_eligible_candidate',
      academicReview: {
        major: 'Computer Science',
        academicStatus: 'studying',
        officialGraduationDate: null,
      },
    });
    expect(response.data[0]).not.toHaveProperty('matchedEnrollmentId');
    expect(response.data[0]).not.toHaveProperty('passportNumberHmac');
  });

  it('returns not found for an unknown request', async () => {
    const dependencies = createService();
    dependencies.findById.mockResolvedValue(null);

    await expect(dependencies.service.get(999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each([
    ['current student', 'studying', null],
    ['alumnus', 'alumni', '2026-05-20'],
  ] as const)(
    '%s: exact eligible match can be approved and activates through the atomic boundary',
    async (_scenario, academicStatus, officialGraduationDate) => {
      const dependencies = createService();
      const context = academicContext(academicStatus);
      dependencies.findById.mockResolvedValue(reviewRequest());
      dependencies.findReviewContexts.mockResolvedValue(
        new Map([[55, context]]),
      );
      dependencies.approve.mockResolvedValue({
        onboardingRequestId: 101,
        holderAccountId: 12,
        verificationStatus: 'matched',
        matchedEnrollmentId: 55,
        rejectionReason: null,
        reviewedAt: '2026-08-04T11:00:00.000Z',
        submittedAt: '2026-08-04T10:00:00.000Z',
      });

      const response = await dependencies.service.decide(
        101,
        '00000000-0000-4000-8000-000000000002',
        { decision: IssuerReviewDecision.APPROVE },
      );

      expect(dependencies.approve).toHaveBeenCalledWith({
        onboardingRequestId: 101,
        reviewedBy: '00000000-0000-4000-8000-000000000002',
      });
      expect(response.data).toMatchObject({
        verificationStatus: 'matched',
        canApprove: false,
        systemMatch: 'exact_eligible_candidate',
        academicReview: { officialGraduationDate },
      });
    },
  );

  it('mismatch cannot be approved', async () => {
    const dependencies = createService();
    dependencies.findById.mockResolvedValue(
      reviewRequest('under_review', null),
    );
    dependencies.findReviewContexts.mockResolvedValue(new Map());

    await expect(
      dependencies.service.decide(101, '00000000-0000-4000-8000-000000000002', {
        decision: IssuerReviewDecision.APPROVE,
      }),
    ).rejects.toThrow(ConflictException);
    expect(dependencies.approve).not.toHaveBeenCalled();
  });

  it('ineligible enrollment cannot be approved', async () => {
    const dependencies = createService();
    dependencies.findById.mockResolvedValue(reviewRequest());
    dependencies.findReviewContexts.mockResolvedValue(
      new Map([[55, academicContext('withdrawn')]]),
    );

    await expect(
      dependencies.service.decide(101, '00000000-0000-4000-8000-000000000002', {
        decision: IssuerReviewDecision.APPROVE,
      }),
    ).rejects.toThrow(ConflictException);
    expect(dependencies.approve).not.toHaveBeenCalled();
  });

  it('issuer rejection leaves holder activation untouched and records the reviewer', async () => {
    const dependencies = createService();
    dependencies.findById.mockResolvedValue(reviewRequest());
    dependencies.findReviewContexts.mockResolvedValue(
      new Map([[55, academicContext()]]),
    );
    dependencies.rejectUnderReview.mockImplementation(
      (input: { reviewedBy: string; reviewedAt: string }) =>
        Promise.resolve({
          ...reviewRequest('rejected'),
          reviewedAt: input.reviewedAt,
          rejectionReason:
            IssuerRejectionReason.IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED,
        }),
    );

    const response = await dependencies.service.decide(
      101,
      '00000000-0000-4000-8000-000000000002',
      {
        decision: IssuerReviewDecision.REJECT,
        rejectionReason:
          IssuerRejectionReason.IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED,
      },
    );

    expect(dependencies.rejectUnderReview).toHaveBeenCalledWith(
      expect.objectContaining({
        onboardingRequestId: 101,
        reviewedBy: '00000000-0000-4000-8000-000000000002',
      }),
    );
    expect(dependencies.approve).not.toHaveBeenCalled();
    expect(response.data).toMatchObject({
      verificationStatus: 'rejected',
      systemMatch: 'exact_eligible_candidate',
      canApprove: false,
      academicReview: { admissionNo: 'DEMO-STU-0001' },
    });
  });

  it('repeated or stale decisions return a conflict', async () => {
    const dependencies = createService();
    dependencies.findById.mockResolvedValue(reviewRequest('rejected'));

    await expect(
      dependencies.service.decide(101, 'reviewer-id', {
        decision: IssuerReviewDecision.REJECT,
        rejectionReason:
          IssuerRejectionReason.IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('protects a concurrent approval/rejection race with a stable conflict', async () => {
    const dependencies = createService();
    dependencies.findById.mockResolvedValue(reviewRequest());
    dependencies.findReviewContexts.mockResolvedValue(
      new Map([[55, academicContext()]]),
    );
    dependencies.approve.mockRejectedValue(
      new ConflictException({
        code: 'REVIEW_NOT_APPROVABLE',
        message: 'This onboarding request cannot be approved.',
      }),
    );

    await expect(
      dependencies.service.decide(101, 'reviewer-id', {
        decision: IssuerReviewDecision.APPROVE,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'REVIEW_NOT_APPROVABLE',
      },
    });
  });

  it('requires the controlled rejection reason defensively', async () => {
    const dependencies = createService();
    dependencies.findById.mockResolvedValue(reviewRequest());

    await expect(
      dependencies.service.decide(101, 'reviewer-id', {
        decision: IssuerReviewDecision.REJECT,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
