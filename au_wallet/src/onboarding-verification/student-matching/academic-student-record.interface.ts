export type AcademicStatus =
  'studying' | 'graduated' | 'alumni' | 'withdrawn' | 'suspended';

export type WalletEligibleAcademicStatus = Extract<
  AcademicStatus,
  'studying' | 'graduated' | 'alumni'
>;

export type WalletIneligibleAcademicStatus = Extract<
  AcademicStatus,
  'withdrawn' | 'suspended'
>;

export interface AcademicIdentityLookup {
  admissionNo: string;
  dateOfBirth: string;
  passportNumberHmac: string;
}

export interface AcademicEnrollmentRecord {
  studentId: number;
  enrollmentId: number;
  academicStatus: AcademicStatus;
}

export interface AcademicStudentLookupResult {
  studentMatchCount: number;
  enrollments: AcademicEnrollmentRecord[];
}

export interface AcademicReviewContext {
  enrollmentId: number;
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
