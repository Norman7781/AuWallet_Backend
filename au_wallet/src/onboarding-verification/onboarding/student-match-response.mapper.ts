import { StudentMatchResult } from '../student-matching/student-match.interface';
import { OnboardingVerificationResponse } from './onboarding-response.interface';

const VERIFIED_MESSAGE = 'The submitted information was verified.';
const GENERIC_REVIEW_MESSAGE =
  'We could not verify the submitted information automatically.';

export function toPublicVerificationResponse(
  result: StudentMatchResult,
): OnboardingVerificationResponse {
  if (result.outcome === 'matched') {
    return {
      status: 'verified',
      message: VERIFIED_MESSAGE,
    };
  }

  return {
    status: 'requires_review',
    message: GENERIC_REVIEW_MESSAGE,
  };
}
