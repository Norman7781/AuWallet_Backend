import {
  WalletEligibleAcademicStatus,
  WalletIneligibleAcademicStatus,
} from './academic-student-record.interface';

export interface StudentMatchInput {
  admissionNo: string;
  dateOfBirth: string;
  passportNumber: string;
}

export type ManualReviewReason =
  | 'no_exact_match'
  | 'ambiguous_student'
  | 'missing_enrollment'
  | 'ambiguous_enrollment';

export type StudentMatchResult =
  | {
      outcome: 'matched';
      studentId: number;
      enrollmentId: number;
      academicStatus: WalletEligibleAcademicStatus;
    }
  | {
      outcome: 'ineligible';
      studentId: number;
      enrollmentId: number;
      academicStatus: WalletIneligibleAcademicStatus;
    }
  | {
      outcome: 'under_review';
      reason: ManualReviewReason;
    };

export interface PreparedStudentMatch {
  passportNumberHmac: string;
  result: StudentMatchResult;
}
