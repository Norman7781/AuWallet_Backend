export type AcademicTranscriptClaims = {
  name: string;
  student_id: string;
  degree_name: string;
  major: string;
  section: string;
  graduation_date?: string; // omit if still enrolled
  gpa?: number;
  academic_standing?: string; //  "distinction"
};

export type PendingOffer = {
  code: string; // pre-authorized_code
  claims: AcademicTranscriptClaims;
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
