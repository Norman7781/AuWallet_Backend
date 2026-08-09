import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Database } from '../../supabase/database.types';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IssuerConnectionStatus,
  OnboardingVerificationStatus,
} from '../../supabase/database.types';

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
  ): Promise<IssuerVerificationDecisionResult>;
}

export interface IssuerVerificationDecisionResult {
  onboardingRequestId: number;
  holderIssuerConnectionId: number;
  issuerCode: string;
  connectionStatus: IssuerConnectionStatus;
  verificationStatus: OnboardingVerificationStatus;
  matchedEnrollmentId: number | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  verifiedAt: string | null;
}

export interface RejectIssuerVerificationInput extends ApproveOnboardingInput {
  rejectionReason: string;
}

export abstract class OnboardingRejectionFinalizer {
  abstract reject(
    input: RejectIssuerVerificationInput,
  ): Promise<IssuerVerificationDecisionResult>;
}

@Injectable()
export class SupabaseOnboardingApprovalFinalizer implements OnboardingApprovalFinalizer {
  constructor(private readonly supabase: SupabaseService) {}

  async approve(
    input: ApproveOnboardingInput,
  ): Promise<IssuerVerificationDecisionResult> {
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
          code: 'ISSUER_VERIFICATION_NOT_APPROVABLE',
          message: 'This issuer verification cannot be approved.',
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
      holderIssuerConnectionId: row.holder_issuer_connection_id,
      issuerCode: row.issuer_code,
      connectionStatus: row.connection_status,
      verificationStatus: row.verification_status,
      matchedEnrollmentId: row.matched_enrollment_id,
      rejectionReason: row.rejection_reason,
      reviewedAt: row.reviewed_at,
      submittedAt: row.submitted_at,
      verifiedAt: row.verified_at,
    };
  }
}

type RejectedVerificationRow =
  Database['wallet']['Functions']['reject_issuer_verification_request']['Returns'][number];

@Injectable()
export class SupabaseOnboardingRejectionFinalizer implements OnboardingRejectionFinalizer {
  constructor(private readonly supabase: SupabaseService) {}

  async reject(
    input: RejectIssuerVerificationInput,
  ): Promise<IssuerVerificationDecisionResult> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .rpc('reject_issuer_verification_request', {
        p_onboarding_request_id: input.onboardingRequestId,
        p_reviewed_by: input.reviewedBy,
        p_rejection_reason: input.rejectionReason,
      })
      .single();

    if (error) {
      if (EXPECTED_APPROVAL_CONFLICT_CODES.has(error.code)) {
        throw new ConflictException({
          code: 'ISSUER_VERIFICATION_ALREADY_DECIDED',
          message: 'This issuer verification is no longer under review.',
        });
      }

      throw new InternalServerErrorException(
        'Unable to reject the issuer verification',
      );
    }

    const row: RejectedVerificationRow | null = data;

    if (!row) {
      throw new InternalServerErrorException(
        'Unable to reject the issuer verification',
      );
    }

    return {
      onboardingRequestId: row.onboarding_request_id,
      holderIssuerConnectionId: row.holder_issuer_connection_id,
      issuerCode: row.issuer_code,
      connectionStatus: row.connection_status,
      verificationStatus: row.verification_status,
      matchedEnrollmentId: row.matched_enrollment_id,
      rejectionReason: row.rejection_reason,
      reviewedAt: row.reviewed_at,
      submittedAt: row.submitted_at,
      verifiedAt: row.verified_at,
    };
  }
}
