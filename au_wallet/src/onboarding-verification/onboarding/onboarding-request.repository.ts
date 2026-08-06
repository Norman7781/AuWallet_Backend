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
  verification_status: OnboardingVerificationStatus;
  matched_enrollment_id: number | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  submitted_at: string;
}

const SAFE_COLUMNS =
  'onboarding_request_id, holder_account_id, verification_status, matched_enrollment_id, rejection_reason, reviewed_at, submitted_at';

function toRecord(row: OnboardingRequestRow): OnboardingRequestRecord {
  return {
    onboardingRequestId: row.onboarding_request_id,
    holderAccountId: row.holder_account_id,
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

  async findLatestByHolderAccountId(
    holderAccountId: number,
  ): Promise<OnboardingRequestRecord | null> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('wallet_onboarding_request')
      .select(SAFE_COLUMNS)
      .eq('holder_account_id', holderAccountId)
      .order('submitted_at', { ascending: false })
      .order('onboarding_request_id', { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<OnboardingRequestRow | null, { merge: false }>();

    if (error) {
      throw new InternalServerErrorException(
        'Unable to load the onboarding request',
      );
    }

    return data ? toRecord(data) : null;
  }

  async createRequest(
    input: CreateOnboardingRequestInput,
  ): Promise<OnboardingRequestRecord> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('wallet_onboarding_request')
      .insert({
        holder_account_id: input.holderAccountId,
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
          code: 'ONBOARDING_REQUEST_ACTIVE',
          message: 'An active onboarding request already exists.',
        });
      }

      throw new InternalServerErrorException(
        'Unable to save the onboarding request',
      );
    }

    return toRecord(data);
  }
}
