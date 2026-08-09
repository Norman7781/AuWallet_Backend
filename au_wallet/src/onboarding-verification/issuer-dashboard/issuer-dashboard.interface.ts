export interface RecentIssuerVerification {
  eventType: 'au_connection_verified';
  programCode: string;
  major: string;
  verifiedAt: string;
}

export interface IssuerConnectionSummaryData {
  verifiedConnectionCount: number;
  recentVerifications: RecentIssuerVerification[];
}

export interface IssuerConnectionSummaryResponse {
  data: IssuerConnectionSummaryData;
  message: 'Issuer connection summary loaded.';
  meta: Record<string, never>;
}
