import { IssuerReviewDecision } from '../issuer-review/dto/review-onboarding-request.dto';
import { IssuerOnboardingRequestRecord } from '../issuer-review/issuer-onboarding-request.interface';
import { IssuerOnboardingRequestRepository } from '../issuer-review/issuer-onboarding-request.repository';
import { IssuerReviewService } from '../issuer-review/issuer-review.service';
import { AcademicReviewContext } from '../student-matching/academic-student-record.interface';
import { AcademicStudentRepository } from '../student-matching/academic-student.repository';
import { StudentMatchingService } from '../student-matching/student-matching.service';
import { CreateOnboardingRequestDto } from './dto/create-onboarding-request.dto';
import { OnboardingRequestRecord } from './onboarding-request.interface';
import { OnboardingRequestRepository } from './onboarding-request.repository';
import { OnboardingService } from './onboarding.service';

describe('Onboarding submission and issuer approval workflow', () => {
  it.each([
    ['current student', 'studying', null],
    ['alumnus', 'alumni', '2026-05-20'],
  ] as const)(
    '%s: exact eligible match becomes under_review, then issuer approval atomically activates the holder',
    async (_scenario, academicStatus, officialGraduationDate) => {
      let holderStatus: 'pending' | 'active' = 'pending';
      let request: IssuerOnboardingRequestRecord | null = null;
      const dto: CreateOnboardingRequestDto = {
        admissionNo: 'DEMO-STU-0001',
        dateOfBirth: '2001-02-03',
        passportNumber: '<synthetic-input>',
      };
      const createRequest = jest.fn(
        (input: {
          holderAccountId: number;
          admissionNo: string;
          dateOfBirth: string;
          matchedEnrollmentId: number | null;
        }): Promise<OnboardingRequestRecord> => {
          request = {
            onboardingRequestId: 101,
            holderAccountId: input.holderAccountId,
            admissionNo: input.admissionNo,
            dateOfBirth: input.dateOfBirth,
            verificationStatus: 'under_review',
            matchedEnrollmentId: input.matchedEnrollmentId,
            reviewedAt: null,
            rejectionReason: null,
            submittedAt: '2026-08-05T10:00:00.000Z',
          };

          return Promise.resolve({
            onboardingRequestId: request.onboardingRequestId,
            holderAccountId: request.holderAccountId,
            verificationStatus: request.verificationStatus,
            matchedEnrollmentId: request.matchedEnrollmentId,
            reviewedAt: request.reviewedAt,
            rejectionReason: request.rejectionReason,
            submittedAt: request.submittedAt,
          });
        },
      );
      const onboarding = new OnboardingService(
        {
          findLatestByHolderAccountId: jest.fn().mockResolvedValue(null),
          createRequest,
        } as unknown as OnboardingRequestRepository,
        {
          prepareAndMatch: jest.fn().mockResolvedValue({
            passportNumberHmac: '<protected-test-value>',
            result: {
              outcome: 'matched',
              studentId: 44,
              enrollmentId: 55,
              academicStatus,
            },
          }),
        } as unknown as StudentMatchingService,
      );

      const submitted = await onboarding.submit(12, dto);

      expect(submitted.data.verificationStatus).toBe('under_review');
      expect(holderStatus).toBe('pending');
      expect(Object.keys(dto).sort()).toEqual(
        ['admissionNo', 'dateOfBirth', 'passportNumber'].sort(),
      );

      const context: AcademicReviewContext = {
        enrollmentId: 55,
        studentName: 'Mali Example',
        admissionNo: 'DEMO-STU-0001',
        dateOfBirth: '2001-02-03',
        degreeName: 'Bachelor of Science',
        major: 'Computer Science',
        majorConcentration: null,
        admissionDate: '2023-06-01',
        academicStatus,
        officialGraduationDate,
      };
      const approve = jest.fn().mockImplementation(() => {
        holderStatus = 'active';
        request = {
          ...(request as unknown as IssuerOnboardingRequestRecord),
          verificationStatus: 'matched',
          reviewedAt: '2026-08-05T11:00:00.000Z',
        };

        return Promise.resolve({
          onboardingRequestId: 101,
          holderAccountId: 12,
          verificationStatus: 'matched',
          matchedEnrollmentId: 55,
          rejectionReason: null,
          reviewedAt: '2026-08-05T11:00:00.000Z',
          submittedAt: '2026-08-05T10:00:00.000Z',
        });
      });
      const issuerReview = new IssuerReviewService(
        {
          findById: jest
            .fn()
            .mockImplementation(() => Promise.resolve(request)),
        } as unknown as IssuerOnboardingRequestRepository,
        {
          findReviewContexts: jest
            .fn()
            .mockResolvedValue(new Map([[55, context]])),
        } as unknown as AcademicStudentRepository,
        { approve },
      );

      const approved = await issuerReview.decide(101, '<reviewer-id>', {
        decision: IssuerReviewDecision.APPROVE,
      });

      expect(approve).toHaveBeenCalledTimes(1);
      expect(approved.data.verificationStatus).toBe('matched');
      expect(approved.data.officialGraduationDate).toBeUndefined();
      expect(approved.data.academicReview?.officialGraduationDate).toBe(
        officialGraduationDate,
      );
      expect(holderStatus).toBe('active');
    },
  );
});
