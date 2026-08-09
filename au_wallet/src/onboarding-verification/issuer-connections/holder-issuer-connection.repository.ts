import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type {
  Database,
  IssuerConnectionStatus,
} from '../../supabase/database.types';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  HolderIssuerConnectionRecord,
  IssuerVerificationSubmissionRecord,
  SubmitIssuerVerificationInput,
} from './issuer-connection.interface';

type ConnectionRow =
  Database['wallet']['Tables']['holder_issuer_connection']['Row'];

const CONNECTION_COLUMNS =
  'holder_issuer_connection_id, holder_account_id, issuer_provider_id, connection_status, verified_at, created_at, updated_at';

type SubmissionRow =
  Database['wallet']['Functions']['submit_issuer_connection_verification']['Returns'][number];

interface ProviderIdRow {
  issuer_provider_id: number;
}

interface VerifiedEnrollmentRow {
  verified_enrollment_id: number;
}

function toRecord(row: ConnectionRow): HolderIssuerConnectionRecord {
  return {
    holderIssuerConnectionId: row.holder_issuer_connection_id,
    holderAccountId: row.holder_account_id,
    issuerProviderId: row.issuer_provider_id,
    connectionStatus: row.connection_status,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class HolderIssuerConnectionRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listByHolder(
    holderAccountId: number,
  ): Promise<HolderIssuerConnectionRecord[]> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('holder_issuer_connection')
      .select(CONNECTION_COLUMNS)
      .eq('holder_account_id', holderAccountId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(
        'Unable to load issuer connections',
      );
    }

    return (data as ConnectionRow[]).map(toRecord);
  }

  async findByHolderAndProvider(
    holderAccountId: number,
    issuerProviderId: number,
  ): Promise<HolderIssuerConnectionRecord | null> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('holder_issuer_connection')
      .select(CONNECTION_COLUMNS)
      .eq('holder_account_id', holderAccountId)
      .eq('issuer_provider_id', issuerProviderId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        'Unable to load issuer connection',
      );
    }

    return data ? toRecord(data as ConnectionRow) : null;
  }

  async submitVerification(
    input: SubmitIssuerVerificationInput,
  ): Promise<IssuerVerificationSubmissionRecord> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .rpc('submit_issuer_connection_verification', {
        p_holder_account_id: input.holderAccountId,
        p_issuer_code: input.issuerCode,
        p_admission_no: input.admissionNo,
        p_date_of_birth: input.dateOfBirth,
        p_passport_number_hmac: input.passportNumberHmac,
      })
      .single();

    if (error) {
      if (error.code === 'P1001') {
        throw new NotFoundException({
          code: 'ISSUER_NOT_FOUND',
          message: 'The issuer provider was not found.',
        });
      }

      if (error.code === 'P1005') {
        throw new ForbiddenException({
          code: 'ACCOUNT_DISABLED',
          message: 'This account cannot currently use wallet services.',
        });
      }

      const conflict = {
        P1002: {
          code: 'ISSUER_CONNECTION_NOT_AVAILABLE',
          message: 'Issuer connection verification is not available.',
        },
        P1003: {
          code: 'ISSUER_CONNECTION_ALREADY_VERIFIED',
          message: 'This issuer connection is already verified.',
        },
        P1004: {
          code: 'ISSUER_VERIFICATION_ACTIVE',
          message: 'An active issuer verification already exists.',
        },
      }[error.code];

      if (conflict) {
        throw new ConflictException(conflict);
      }

      throw new InternalServerErrorException(
        'Unable to verify the issuer connection',
      );
    }

    const row = data as SubmissionRow | null;

    if (!row) {
      throw new InternalServerErrorException(
        'Unable to verify the issuer connection',
      );
    }

    return {
      issuerCode: row.issuer_code,
      connectionStatus: row.connection_status,
      verificationStatus: row.verification_status,
      rejectionReason: row.rejection_reason,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      verifiedAt: row.verified_at,
    };
  }

  async findVerifiedEnrollmentIdsByIssuerCode(
    issuerCode: string,
    enrollmentIds: number[],
  ): Promise<Set<number>> {
    const uniqueEnrollmentIds = [
      ...new Set(
        enrollmentIds.filter((id) => Number.isSafeInteger(id) && id > 0),
      ),
    ];

    if (uniqueEnrollmentIds.length === 0) {
      return new Set();
    }

    const { data: provider, error: providerError } = await this.supabase
      .schema('wallet')
      .from('issuer_provider')
      .select('issuer_provider_id')
      .eq('issuer_code', issuerCode)
      .maybeSingle()
      .overrideTypes<ProviderIdRow | null, { merge: false }>();

    if (providerError) {
      throw new InternalServerErrorException(
        'Unable to load issuer connection state',
      );
    }

    if (!provider) {
      return new Set();
    }

    const { data, error } = await this.supabase
      .schema('wallet')
      .from('holder_issuer_connection')
      .select('verified_enrollment_id')
      .eq('issuer_provider_id', provider.issuer_provider_id)
      .eq('connection_status', 'verified')
      .in('verified_enrollment_id', uniqueEnrollmentIds)
      .overrideTypes<VerifiedEnrollmentRow[], { merge: false }>();

    if (error) {
      throw new InternalServerErrorException(
        'Unable to load issuer connection state',
      );
    }

    return new Set((data ?? []).map((row) => row.verified_enrollment_id));
  }

  async createPending(
    holderAccountId: number,
    issuerProviderId: number,
  ): Promise<HolderIssuerConnectionRecord> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('holder_issuer_connection')
      .insert({
        holder_account_id: holderAccountId,
        issuer_provider_id: issuerProviderId,
        connection_status: 'pending_verification',
      })
      .select(CONNECTION_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException({
          code: 'ISSUER_VERIFICATION_ACTIVE',
          message: 'An active issuer verification already exists.',
        });
      }

      throw new InternalServerErrorException(
        'Unable to create issuer connection',
      );
    }

    return toRecord(data as ConnectionRow);
  }

  async updateStatus(
    holderIssuerConnectionId: number,
    connectionStatus: Extract<
      IssuerConnectionStatus,
      'pending_verification' | 'rejected'
    >,
  ): Promise<HolderIssuerConnectionRecord> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('holder_issuer_connection')
      .update({
        connection_status: connectionStatus,
        verified_enrollment_id: null,
        verified_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('holder_issuer_connection_id', holderIssuerConnectionId)
      .select(CONNECTION_COLUMNS)
      .single();

    if (error) {
      throw new InternalServerErrorException(
        'Unable to update issuer connection',
      );
    }

    return toRecord(data as ConnectionRow);
  }
}
