import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  CreateOnboardingRequestInput,
  OnboardingRequestRecord,
  OnboardingVerificationStatus,
} from './onboarding-request.interface';

interface OnboardingRequestRow {
  onboarding_request_id: number;
  holder_account_id: number;
  holder_issuer_connection_id: number;
  verification_status: OnboardingVerificationStatus;
  matched_enrollment_id: number | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  submitted_at: string;
}

const SAFE_COLUMNS =
  'onboarding_request_id, holder_account_id, holder_issuer_connection_id, verification_status, matched_enrollment_id, rejection_reason, reviewed_at, submitted_at';

function toRecord(row: OnboardingRequestRow): OnboardingRequestRecord {
  return {
    onboardingRequestId: row.onboarding_request_id,
    holderAccountId: row.holder_account_id,
    holderIssuerConnectionId: row.holder_issuer_connection_id,
    verificationStatus: row.verification_status,
    matchedEnrollmentId: row.matched_enrollment_id,
    rejectionReason: row.rejection_reason,
    reviewedAt: row.reviewed_at,
    submittedAt: row.submitted_at,
  };
}

@Injectable()
export class OnboardingRequestRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findLatestByConnectionId(
    holderIssuerConnectionId: number,
  ): Promise<OnboardingRequestRecord | null> {
    return this.findByConnection(holderIssuerConnectionId, false);
  }

  async findActiveByConnectionId(
    holderIssuerConnectionId: number,
  ): Promise<OnboardingRequestRecord | null> {
    return this.findByConnection(holderIssuerConnectionId, true);
  }

  async createRequest(
    input: CreateOnboardingRequestInput,
  ): Promise<OnboardingRequestRecord> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('wallet_onboarding_request')
      .insert({
        holder_account_id: input.holderAccountId,
        holder_issuer_connection_id: input.holderIssuerConnectionId,
        admission_no: input.admissionNo,
        date_of_birth: input.dateOfBirth,
        passport_number_hmac: input.passportNumberHmac,
        verification_status: input.verificationStatus,
        matched_enrollment_id: input.matchedEnrollmentId,
        rejection_reason: input.rejectionReason,
      })
      .select(SAFE_COLUMNS)
      .single()
      .overrideTypes<OnboardingRequestRow, { merge: false }>();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException({
          code: 'ISSUER_VERIFICATION_ACTIVE',
          message: 'An active issuer verification already exists.',
        });
      }

      throw new InternalServerErrorException(
        'Unable to save the onboarding request',
      );
    }

    return toRecord(data);
  }

  private async findByConnection(
    holderIssuerConnectionId: number,
    activeOnly: boolean,
  ): Promise<OnboardingRequestRecord | null> {
    let query = this.supabase
      .schema('wallet')
      .from('wallet_onboarding_request')
      .select(SAFE_COLUMNS)
      .eq('holder_issuer_connection_id', holderIssuerConnectionId);

    if (activeOnly) {
      query = query.in('verification_status', ['submitted', 'under_review']);
    }

    const { data, error } = await query
      .order('submitted_at', { ascending: false })
      .order('onboarding_request_id', { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<OnboardingRequestRow | null, { merge: false }>();

    if (error) {
      throw new InternalServerErrorException(
        'Unable to load the issuer verification request',
      );
    }

    return data ? toRecord(data) : null;
  }
}
