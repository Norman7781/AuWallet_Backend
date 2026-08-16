import {
  AcademicTranscriptClaims,
  CourseItem,
  SemesterSummaryItem,
} from './Academic_tran_type';

// Shape based on what StudentAcademicReview in IssueTranscript.jsx actually
// consumes (i.e. the combined result of getStudentAcademicReview +
// getStudentAcademicPreview). Adjust this to match your real DTO/entity
// if the field names differ — this is inferred from the frontend usage,
// not from your backend source.
export interface StudentAcademicCourse {
  courseCode: string;
  courseTitle: string;
  credits: number;
  grade: string;
  resultType?: string | null;
}

export interface StudentAcademicTerm {
  termCode: string;
  termLabel: string;
  gpa?: number | null;
  earnedCredits?: number | null;
  courses: StudentAcademicCourse[];
}

export interface StudentAcademicRecord {
  studentNumber: string;
  fullName: string;
  facultyName: string;
  degreeName: string;
  major: string;
  majorConcentration?: string | null;
  admissionDate?: string | null; // ISO date
  graduationDate?: string | null; // ISO date
  academicStatus?: string | null;
  graduationStatus?: string | null;
  requirementsFulfilled?: boolean | null;
  requiredCredits?: number | null;
  creditSummary?: {
    completed?: number | null;
    transferred?: number | null;
    earned?: number | null;
  } | null;
  award?: string | null;
  cumulativeGpa?: number | null;
  totalEarnedCredits?: number | null;
  transferCredits?: number | null;
  terms: StudentAcademicTerm[];
  unassignedResults?: StudentAcademicCourse[] | null;
  // Repository returns additional fields (e.g. walletEligibility) that
  // the transcript builder below doesn't use — those pass through fine
  // structurally and don't need to be declared here.
}

function splitFullName(fullName: string): {
  givenName: string;
  familyName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { givenName: parts[0], familyName: '' };
  return {
    givenName: parts.slice(0, -1).join(' '),
    familyName: parts[parts.length - 1],
  };
}

function toCourseItems(
  courses: StudentAcademicCourse[],
  termLabel?: string,
): CourseItem[] {
  return courses.map((c) => ({
    courseCode: c.courseCode,
    name: c.courseTitle,
    numberOfCredits: c.credits,
    gradeText: c.grade,
    termDuration: termLabel,
    additionalType: c.resultType ?? undefined,
  }));
}

/**
 * Builds the full, schema-shaped transcript claims from the issuer's
 * authoritative student record. This is what makes it safe to accept only
 * a studentNumber from the client — the actual grade/course data always
 * comes from the server side, never from the request body.
 *
 * NOTE: a few schema-required sections have no equivalent in the review
 * data shown to the frontend (documentContext.author, educationalOrganization
 * address/registrar, additionalInformation.hons/thesisTitle). These are
 * filled with reasonable defaults below — replace with real data if you
 * have it elsewhere.
 */
export function buildAcademicTranscriptClaims(
  record: StudentAcademicRecord,
): AcademicTranscriptClaims {
  const { givenName, familyName } = splitFullName(record.fullName);

  const semesterSummary: SemesterSummaryItem[] = record.terms.map((t) => ({
    semesterName: t.termLabel,
    semesterCreditEarned: t.earnedCredits ?? undefined,
    semesterGPA: t.gpa ?? undefined,
  }));

  const itemListElement: CourseItem[] = [
    ...record.terms.flatMap((t) => toCourseItems(t.courses, t.termLabel)),
    ...toCourseItems(record.unassignedResults ?? []),
  ];

  return {
    documentContext: {
      schemaVersion: '1.0',
      author: { name: 'Assumption University of Thailand Issuer System' },
    },
    documentInformation: {
      identifier: { propertyID: 'studentNumber', value: record.studentNumber },
      additionalType: 'AcademicTranscript',
      datePublished: new Date().toISOString().slice(0, 10),
      inLanguage: { name: 'English' },
    },
    student: {
      identifier: { name: 'studentNumber', value: record.studentNumber },
      honorificPrefix: '', // not present in review data — fill if you have it
      givenName,
      familyName,
      facultyName: record.facultyName,
      dateOfAdmission: record.admissionDate ?? undefined,
      programContext: {
        name: record.degreeName,
        endDate: record.graduationDate ?? undefined,
        programType: record.major
          ? [{ termCode: '', name: record.major }]
          : undefined,
      },
    },
    educationalOrganization: {
      name: 'Assumption University of Thailand',
    },
    courseList: { itemListElement },
    academicSummary: {
      semesterSummary,
      totalCreditEarned:
        record.totalEarnedCredits ?? record.creditSummary?.earned ?? undefined,
      totalGPAX: record.cumulativeGpa ?? undefined,
    },
    additionalInformation: [
      {
        hons: record.award ?? '',
        thesisTitle: '', // not present in review data — fill if you have it
      },
    ],
  };
}
