export type WalletEligibility = 'verified' | 'not_verified';
export type CredentialStatus = WalletEligibility | 'issued';
/**
 * Explains why graduation fields are present or absent without turning a
 * missing academic fact into display text.
 */
export type GraduationRecordStatus =
  | 'recorded'
  | 'not_applicable'
  | 'missing';

export interface IssuerProgramOption {
  facultyCode: string;
  facultyName: string;
  programCode: string;
  degreeName: string;
  major: string;
  majorConcentration: string | null;
}

export interface IssuerStudentSummary {
  studentNumber: string;
  fullName: string;
  facultyCode: string;
  facultyName: string;
  programCode: string;
  degreeName: string;
  major: string;
  majorConcentration: string | null;
  academicStatus: string;
  graduationDate: string | null;
  graduationYear: number | null;
  graduationClass: number | null;
  /**
   * `not_applicable` means the student has not completed the programme yet.
   * `missing` means a graduate/alumnus is missing an expected graduation row.
   */
  graduationRecordStatus: GraduationRecordStatus;
  walletEligibility: WalletEligibility;
  /**
   * Display status for the issuer's Student Data table. `issued` takes
   * precedence over wallet verification once a transcript VC is issued.
   */
  credentialStatus: CredentialStatus;
}

export interface IssuedCredentialSummary {
  credentialId: string;
  studentNumber: string;
  major: string | null;
  credentialType: 'academic_transcript';
  issuedAt: string;
  status: 'issued';
}

export interface AcademicReview extends IssuerStudentSummary {
  admissionDate: string;
  requiredCredits: number;
  creditSummary: {
    completed: number | null;
    transferred: number | null;
    earned: number | null;
  };
  cumulativeGpa: number | null;
  graduationStatus: string | null;
  requirementsFulfilled: boolean | null;
  award: string | null;
}

export interface AcademicPreviewCourse {
  courseCode: string;
  courseTitle: string;
  credits: number;
  grade: string;
  resultType: string;
}

export interface AcademicPreviewTerm {
  termCode: string;
  termLabel: string;
  academicYear: number;
  semesterNo: number;
  gpa: number | null;
  earnedCredits: number;
  courses: AcademicPreviewCourse[];
}

export interface AcademicPreview {
  studentNumber: string;
  cumulativeGpa: number | null;
  totalEarnedCredits: number;
  transferCredits: number;
  terms: AcademicPreviewTerm[];
  unassignedResults: AcademicPreviewCourse[];
}
