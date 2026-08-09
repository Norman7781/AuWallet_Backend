import type {
  IssuerAvailability,
  IssuerConnectionStatus,
  OnboardingVerificationStatus,
} from '../../supabase/database.types';

export interface IssuerProviderRecord {
  issuerProviderId: number;
  issuerCode: string;
  displayName: string;
  description: string;
  availability: IssuerAvailability;
  connectionVerificationEnabled: boolean;
  isMock: boolean;
}

export interface HolderIssuerConnectionRecord {
  holderIssuerConnectionId: number;
  holderAccountId: number;
  issuerProviderId: number;
  connectionStatus: IssuerConnectionStatus;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicIssuerProvider {
  issuerCode: string;
  displayName: string;
  description: string;
  availability: IssuerAvailability;
  connectionEnabled: boolean;
  isMock: boolean;
  connectionStatus: IssuerConnectionStatus | null;
}

export interface PublicIssuerConnection {
  issuerCode: string;
  displayName: string;
  connectionStatus: IssuerConnectionStatus;
  latestVerificationStatus: OnboardingVerificationStatus | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  verifiedAt: string | null;
}

export interface SubmitIssuerVerificationInput {
  holderAccountId: number;
  issuerCode: string;
  admissionNo: string;
  dateOfBirth: string;
  passportNumberHmac: string;
}

export interface IssuerVerificationSubmissionRecord {
  issuerCode: string;
  connectionStatus: IssuerConnectionStatus;
  verificationStatus: OnboardingVerificationStatus;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  verifiedAt: string | null;
}

export interface IssuerProviderListResponse {
  data: PublicIssuerProvider[];
  message: string;
  meta: Record<string, never>;
}

export interface IssuerConnectionListResponse {
  data: PublicIssuerConnection[];
  message: string;
  meta: Record<string, never>;
}

export interface IssuerConnectionResponse {
  data: PublicIssuerConnection;
  message: string;
  meta: Record<string, never>;
}
