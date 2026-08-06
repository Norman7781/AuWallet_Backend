import { OnboardingVerificationStatus } from '../onboarding/onboarding-request.interface';
import { AcademicStatus } from '../student-matching/academic-student-record.interface';

export interface IssuerOnboardingRequestRecord {
  onboardingRequestId: number;
  holderAccountId: number;
  admissionNo: string;
  dateOfBirth: string;
  verificationStatus: OnboardingVerificationStatus;
  matchedEnrollmentId: number | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  submittedAt: string;
}

export type SystemMatchIndicator = 'exact_eligible_candidate' | 'not_confirmed';

export interface PublicAcademicReviewContext {
  studentName: string;
  admissionNo: string;
  dateOfBirth: string;
  degreeName: string;
  major: string;
  majorConcentration: string | null;
  admissionDate: string;
  academicStatus: AcademicStatus;
  officialGraduationDate: string | null;
}

export interface PublicIssuerOnboardingRequest {
  onboardingRequestId: number;
  holderAccountId: number;
  admissionNo: string;
  dateOfBirth: string;
  verificationStatus: OnboardingVerificationStatus;
  systemMatch: SystemMatchIndicator;
  canApprove: boolean;
  academicReview: PublicAcademicReviewContext | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  submittedAt: string;
}

export interface IssuerOnboardingRequestResponse {
  data: PublicIssuerOnboardingRequest;
  message: string;
  meta: Record<string, never>;
}

export interface IssuerOnboardingRequestListResponse {
  data: PublicIssuerOnboardingRequest[];
  message: string;
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface IssuerOnboardingRequestPage {
  records: IssuerOnboardingRequestRecord[];
  total: number;
}
