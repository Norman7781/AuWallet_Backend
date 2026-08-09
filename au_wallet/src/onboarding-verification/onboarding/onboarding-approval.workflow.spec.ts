import { IssuerReviewDecision } from '../issuer-review/dto/review-onboarding-request.dto';
import { IssuerReviewService } from '../issuer-review/issuer-review.service';

describe('Issuer connection approval workflow', () => {
  it.each(['studying', 'alumni'])(
    '%s candidate approval verifies the connection without changing holder status',
    async (academicStatus) => {
      const record = {
        onboardingRequestId: 101,
        holderAccountId: 5,
        admissionNo: 'SYNTHETIC-ID',
        dateOfBirth: '2000-01-01',
        verificationStatus: 'under_review' as const,
        matchedEnrollmentId: 40,
        reviewedAt: null,
        rejectionReason: null,
        submittedAt: '2026-08-09T01:00:00.000Z',
      };
      const requests = { findById: jest.fn().mockResolvedValue(record) };
      const academics = {
        findReviewContexts: jest.fn().mockResolvedValue(
          new Map([
            [
              40,
              {
                enrollmentId: 40,
                studentName: 'Synthetic Student',
                admissionNo: 'SYNTHETIC-ID',
                dateOfBirth: '2000-01-01',
                degreeName: 'Bachelor of Science',
                major: 'Computer Science',
                majorConcentration: null,
                admissionDate: '2022-06-01',
                academicStatus,
                officialGraduationDate:
                  academicStatus === 'alumni' ? '2026-05-01' : null,
              },
            ],
          ]),
        ),
      };
      const approval = {
        approve: jest.fn().mockResolvedValue({
          onboardingRequestId: 101,
          holderIssuerConnectionId: 20,
          issuerCode: 'assumption-university',
          connectionStatus: 'verified',
          verificationStatus: 'matched',
          matchedEnrollmentId: 40,
          rejectionReason: null,
          reviewedAt: '2026-08-09T02:00:00.000Z',
          submittedAt: record.submittedAt,
          verifiedAt: '2026-08-09T02:00:00.000Z',
        }),
      };
      const rejection = { reject: jest.fn() };
      const service = new IssuerReviewService(
        requests as never,
        academics as never,
        approval,
        rejection,
      );

      const response = await service.decide(
        101,
        '00000000-0000-4000-8000-000000000002',
        { decision: IssuerReviewDecision.APPROVE },
      );

      expect(response.data.verificationStatus).toBe('matched');
      expect(response.message).toBe('Issuer connection verified.');
      expect(response).not.toHaveProperty('data.accountStatus');
      expect(approval.approve).toHaveBeenCalledTimes(1);
    },
  );
});
