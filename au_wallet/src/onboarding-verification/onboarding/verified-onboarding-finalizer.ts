import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Database } from '../../supabase/database.types';
import { SupabaseService } from '../../supabase/supabase.service';
import { OnboardingRequestRecord } from './onboarding-request.interface';

export interface ApproveOnboardingInput {
  onboardingRequestId: number;
  reviewedBy: string;
}

type ApprovedOnboardingRow =
  Database['wallet']['Functions']['approve_onboarding_request']['Returns'][number];

const EXPECTED_APPROVAL_CONFLICT_CODES = new Set([
  '22023',
  '40001',
  'P0001',
  'P0002',
]);

export abstract class OnboardingApprovalFinalizer {
  abstract approve(
    input: ApproveOnboardingInput,
  ): Promise<OnboardingRequestRecord>;
}

@Injectable()
export class SupabaseOnboardingApprovalFinalizer implements OnboardingApprovalFinalizer {
  constructor(private readonly supabase: SupabaseService) {}

  async approve(
    input: ApproveOnboardingInput,
  ): Promise<OnboardingRequestRecord> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .rpc('approve_onboarding_request', {
        p_onboarding_request_id: input.onboardingRequestId,
        p_reviewed_by: input.reviewedBy,
      })
      .single();

    if (error) {
      if (EXPECTED_APPROVAL_CONFLICT_CODES.has(error.code)) {
        throw new ConflictException({
          code: 'REVIEW_NOT_APPROVABLE',
          message: 'This onboarding request cannot be approved.',
        });
      }

      throw new InternalServerErrorException(
        'Unable to approve the onboarding request',
      );
    }

    const row: ApprovedOnboardingRow | null = data;

    if (!row) {
      throw new InternalServerErrorException(
        'Unable to approve the onboarding request',
      );
    }

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
}
