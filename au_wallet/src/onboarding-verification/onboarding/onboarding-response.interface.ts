export type PublicVerificationStatus = 'verified' | 'requires_review';

export interface OnboardingVerificationResponse {
  status: PublicVerificationStatus;
  message: string;
}
