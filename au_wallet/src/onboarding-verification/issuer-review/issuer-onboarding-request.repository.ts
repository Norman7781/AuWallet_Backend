import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { OnboardingVerificationStatus } from '../onboarding/onboarding-request.interface';
import {
  IssuerOnboardingRequestPage,
  IssuerOnboardingRequestRecord,
} from './issuer-onboarding-request.interface';

interface IssuerOnboardingRequestRow {
  onboarding_request_id: number;
  holder_account_id: number;
  admission_no: string;
  date_of_birth: string;
  verification_status: OnboardingVerificationStatus;
  matched_enrollment_id: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  submitted_at: string;
}

const ISSUER_SAFE_COLUMNS =
  'onboarding_request_id, holder_account_id, admission_no, date_of_birth, verification_status, matched_enrollment_id, reviewed_at, rejection_reason, submitted_at';

function toRecord(
  row: IssuerOnboardingRequestRow,
): IssuerOnboardingRequestRecord {
  return {
    onboardingRequestId: row.onboarding_request_id,
    holderAccountId: row.holder_account_id,
    admissionNo: row.admission_no,
    dateOfBirth: row.date_of_birth,
    verificationStatus: row.verification_status,
    matchedEnrollmentId: row.matched_enrollment_id,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
  };
}

@Injectable()
export class IssuerOnboardingRequestRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listUnderReview(
    page: number,
    limit: number,
  ): Promise<IssuerOnboardingRequestPage> {
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    const { data, error, count } = await this.supabase
      .schema('wallet')
      .from('wallet_onboarding_request')
      .select(ISSUER_SAFE_COLUMNS, { count: 'exact' })
      .eq('verification_status', 'under_review')
      .order('submitted_at', { ascending: true })
      .range(start, end)
      .overrideTypes<IssuerOnboardingRequestRow[], { merge: false }>();

    if (error) {
      throw new InternalServerErrorException(
        'Unable to load onboarding requests',
      );
    }

    return {
      records: (data ?? []).map(toRecord),
      total: count ?? 0,
    };
  }

  async findById(
    onboardingRequestId: number,
  ): Promise<IssuerOnboardingRequestRecord | null> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('wallet_onboarding_request')
      .select(ISSUER_SAFE_COLUMNS)
      .eq('onboarding_request_id', onboardingRequestId)
      .maybeSingle()
      .overrideTypes<IssuerOnboardingRequestRow | null, { merge: false }>();

    if (error) {
      throw new InternalServerErrorException(
        'Unable to load the onboarding request',
      );
    }

    return data ? toRecord(data) : null;
  }
}
