import { StudentMatchResult } from '../student-matching/student-match.interface';
import { toPublicVerificationResponse } from './student-match-response.mapper';

describe('toPublicVerificationResponse', () => {
  it('returns a minimal success response without academic identifiers', () => {
    const response = toPublicVerificationResponse({
      outcome: 'matched',
      studentId: 11,
      enrollmentId: 22,
      academicStatus: 'graduated',
    });

    expect(response).toEqual({
      status: 'verified',
      message: 'The submitted information was verified.',
    });
    expect(response).not.toHaveProperty('studentId');
    expect(response).not.toHaveProperty('enrollmentId');
    expect(response).not.toHaveProperty('academicStatus');
  });

  it.each<StudentMatchResult>([
    { outcome: 'under_review', reason: 'no_exact_match' },
    { outcome: 'under_review', reason: 'ambiguous_student' },
    { outcome: 'under_review', reason: 'missing_enrollment' },
    { outcome: 'under_review', reason: 'ambiguous_enrollment' },
    {
      outcome: 'ineligible',
      studentId: 11,
      enrollmentId: 22,
      academicStatus: 'withdrawn',
    },
    {
      outcome: 'ineligible',
      studentId: 12,
      enrollmentId: 23,
      academicStatus: 'suspended',
    },
  ])('uses the same public response for every non-match outcome', (result) => {
    const response = toPublicVerificationResponse(result);

    expect(response).toEqual({
      status: 'requires_review',
      message: 'We could not verify the submitted information automatically.',
    });
    expect(response).not.toHaveProperty('reason');
    expect(response).not.toHaveProperty('academicStatus');
  });
});
