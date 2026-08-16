// Types mirror the academic-transcript JSON Schema (credentialSubject_type
// and its nested definitions). Field names and required/optional status
// match the schema exactly.

export interface NameValue {
  name: string;
  value: string;
}

export interface Author {
  name: string;
}

export interface DocumentContext {
  identifier?: NameValue[];
  schemaVersion?: string;
  author?: Author;
}

export interface PropertyIdValue {
  propertyID?: string;
  value?: string;
}

export interface InLanguage {
  name?: string;
  alternateName?: string;
}

export interface DocumentInformation {
  identifier: PropertyIdValue;
  name?: string;
  additionalType: string;
  educationalUse?: string;
  datePublished: string;
  inLanguage: InLanguage;
}

export interface Identifier3 {
  name?: string;
  value?: string;
}

export interface ResidentCountryOrTerritory {
  addressCountry?: string;
}

export interface ProgramTypeItem {
  termCode: string;
  name: string;
  additionalType?: string;
}

export interface ProgramContext {
  identifier?: Identifier3;
  name?: string;
  programType?: ProgramTypeItem[];
  endDate?: string;
}

export interface Student {
  identifier: Identifier3;
  honorificPrefix: string;
  givenName: string;
  familyName: string;
  gender?: string;
  birthDate?: string;
  nationality?: string;
  residentCountryOrTerritory?: ResidentCountryOrTerritory;
  image?: string;
  dateOfAdmission?: string;
  facultyName: string;
  programContext?: ProgramContext;
}

export interface Address {
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
}

export interface SubOrganization {
  identifier: Identifier3;
  name: string;
  address: Address;
}

export interface Registrar {
  identifier: Identifier3;
  jobTitle: string;
  honorificPrefix: string;
  name: string;
  email: string;
}

export interface EducationalOrganization {
  identifier?: Identifier3;
  name: string;
  schoolLevel?: string;
  address?: Address;
  subOrganization?: SubOrganization;
  registrar?: Registrar;
}

export interface CourseTransferItem {
  courseCode: string;
  provider: Author;
  name: string;
}

export interface Affiliation {
  identifier?: NameValue[];
  name?: string;
}

export interface Provider {
  name: string;
  jobTitle?: string;
  affiliation: Affiliation;
}

export interface OrgProvider {
  identifier: NameValue[];
  name: string;
}

export interface UsageInfoItem {
  about: string;
  text: string;
}

export interface HasCourse {
  courseCode?: string;
  provider?: Provider;
  usageInfo?: UsageInfoItem[];
}

export interface CourseItem {
  courseCode: string;
  name: string;
  additionalType?: string;
  description?: string;
  numberOfCredits: number;
  creditEarned?: number;
  grade?: number;
  gradeText: string;
  pointEarned?: number;
  programType?: string;
  termsPerYear?: string;
  timeToComplete?: string;
  CourseTransfer?: CourseTransferItem[];
  termDuration?: string;
  provider?: OrgProvider;
  CourseDescription?: string;
  occupationalCategory?: string;
  url?: string;
  hasCourse?: HasCourse;
}

export interface CourseList {
  itemListElement?: CourseItem[];
}

export interface SemesterSummaryItem {
  educationTypeSystem?: string;
  semesterName: string;
  semesterStatus?: string;
  year?: string;
  semesterCreditValue?: number;
  semesterCreditEarned?: number;
  semesterCreditCalculated?: number;
  semesterPointEarned?: number;
  semesterGPA?: number;
  semesterGPAX?: number;
  remark?: string;
}

export interface AcademicSummary {
  semesterSummary?: SemesterSummaryItem[];
  totalCreditValue?: number;
  totalCreditEarned?: number;
  totalCreditCalculated?: number;
  totalPointEarned?: number;
  totalGPAX?: number;
  remark?: string;
}

export interface InformationNote {
  about?: string;
  text?: string;
}

export interface AdditionalInformationItem {
  hons: string;
  thesisTitle: string;
  infomationNote?: InformationNote;
}

// This is what actually gets carried as (selectively disclosable) claims
// in the issued SD-JWT VC — i.e. the contents of the schema's
// credentialSubject_type, minus the envelope-only "id" field.
export interface AcademicTranscriptClaims {
  documentContext: DocumentContext;
  documentInformation: DocumentInformation;
  student: Student;
  educationalOrganization: EducationalOrganization;
  courseList: CourseList;
  academicSummary: AcademicSummary;
  additionalInformation?: AdditionalInformationItem[];
}

export type PendingOffer = {
  code: string; // pre-authorized_code
  claims: AcademicTranscriptClaims;
  studentId: string; // derived from claims.student.identifier.value, used for dedupe/lookup
  status: 'pending' | 'issued' | 'revoked';
  accessToken?: string;
  statusIdx?: number;
  createdAt: Date;
  issuedAt?: Date;
  cNonce?: string;
};

export type ConfirmationClaims = {
  jwk: Record<string, any>;
};

export type CredentialRequest = {
  proof: {
    proof_type: 'jwt';
    jwt: string;
  };
};
