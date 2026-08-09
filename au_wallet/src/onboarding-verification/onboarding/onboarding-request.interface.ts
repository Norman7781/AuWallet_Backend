export type OnboardingVerificationStatus =
  'submitted' | 'under_review' | 'matched' | 'rejected';

export interface OnboardingRequestRecord {
  onboardingRequestId: number;
  holderAccountId: number;
  holderIssuerConnectionId: number;
  verificationStatus: OnboardingVerificationStatus;
  matchedEnrollmentId: number | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  submittedAt: string;
}

export interface CreateOnboardingRequestInput {
  holderAccountId: number;
  holderIssuerConnectionId: number;
  admissionNo: string;
  dateOfBirth: string;
  passportNumberHmac: string;
  verificationStatus: Extract<
    OnboardingVerificationStatus,
    'under_review' | 'rejected'
  >;
  matchedEnrollmentId: number | null;
  rejectionReason: string | null;
}

export interface PublicOnboardingRequest {
  onboardingRequestId: number;
  verificationStatus: OnboardingVerificationStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  submittedAt: string;
}

export interface OnboardingRequestResponse {
  data: PublicOnboardingRequest;
  message: string;
  meta: Record<string, never>;
}
