import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { ASSUMPTION_UNIVERSITY_ISSUER_CODE } from '../issuer-connections/issuer-connection.service';
import type { IssuerConnectionSummaryData } from './issuer-dashboard.interface';

export const RECENT_VERIFICATION_LIMIT = 10;

interface ProviderIdRow {
  issuer_provider_id: number;
}

interface VerifiedConnectionRow {
  issuer_provider_id: number;
  connection_status: string;
  verified_enrollment_id: number;
  verified_at: string;
}

interface EnrollmentProgramIdRow {
  enrollment_id: number;
  program_id: number;
}

interface ProgramSummaryRow {
  program_id: number;
  program_code: string;
  major: string;
}

@Injectable()
export class IssuerDashboardRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async loadConnectionSummary(): Promise<IssuerConnectionSummaryData> {
    const { data: provider, error: providerError } = await this.supabase
      .schema('wallet')
      .from('issuer_provider')
      .select('issuer_provider_id')
      .eq('issuer_code', ASSUMPTION_UNIVERSITY_ISSUER_CODE)
      .maybeSingle()
      .overrideTypes<ProviderIdRow | null, { merge: false }>();

    if (providerError) {
      this.failSafely();
    }

    if (!provider) {
      return { verifiedConnectionCount: 0, recentVerifications: [] };
    }

    const { data, error, count } = await this.supabase
      .schema('wallet')
      .from('holder_issuer_connection')
      .select(
        'issuer_provider_id, connection_status, verified_enrollment_id, verified_at',
        { count: 'exact' },
      )
      .eq('issuer_provider_id', provider.issuer_provider_id)
      .eq('connection_status', 'verified')
      .not('verified_enrollment_id', 'is', null)
      .not('verified_at', 'is', null)
      .order('verified_at', { ascending: false })
      .limit(RECENT_VERIFICATION_LIMIT)
      .overrideTypes<VerifiedConnectionRow[], { merge: false }>();

    if (error || count === null) {
      this.failSafely();
    }

    const connectionRows = [...(data ?? [])]
      .filter(
        (row) =>
          row.issuer_provider_id === provider.issuer_provider_id &&
          row.connection_status === 'verified' &&
          Number.isSafeInteger(row.verified_enrollment_id) &&
          row.verified_enrollment_id > 0 &&
          typeof row.verified_at === 'string',
      )
      .sort((left, right) => right.verified_at.localeCompare(left.verified_at))
      .slice(0, RECENT_VERIFICATION_LIMIT);

    if (connectionRows.length === 0) {
      return {
        verifiedConnectionCount: count,
        recentVerifications: [],
      };
    }

    const enrollmentIds = [
      ...new Set(connectionRows.map((row) => row.verified_enrollment_id)),
    ];
    const { data: enrollments, error: enrollmentError } = await this.supabase
      .schema('academic')
      .from('student_program_enrollment')
      .select('enrollment_id, program_id')
      .in('enrollment_id', enrollmentIds)
      .overrideTypes<EnrollmentProgramIdRow[], { merge: false }>();

    if (enrollmentError) {
      this.failSafely();
    }

    const enrollmentRows = enrollments ?? [];
    const programIds = [
      ...new Set(enrollmentRows.map((row) => row.program_id)),
    ];

    if (programIds.length === 0) {
      this.failSafely();
    }

    const { data: programs, error: programError } = await this.supabase
      .schema('academic')
      .from('program')
      .select('program_id, program_code, major')
      .in('program_id', programIds)
      .overrideTypes<ProgramSummaryRow[], { merge: false }>();

    if (programError) {
      this.failSafely();
    }

    const enrollmentToProgram = new Map(
      enrollmentRows.map((row) => [row.enrollment_id, row.program_id]),
    );
    const programsById = new Map(
      (programs ?? []).map((row) => [row.program_id, row]),
    );

    const recentVerifications = connectionRows.map((connection) => {
      const programId = enrollmentToProgram.get(
        connection.verified_enrollment_id,
      );
      const program =
        programId === undefined ? undefined : programsById.get(programId);

      if (!program) {
        this.failSafely();
      }

      return {
        eventType: 'au_connection_verified' as const,
        programCode: program.program_code,
        major: program.major,
        verifiedAt: connection.verified_at,
      };
    });

    return {
      verifiedConnectionCount: count,
      recentVerifications,
    };
  }

  private failSafely(): never {
    throw new InternalServerErrorException(
      'Unable to load issuer connection summary',
    );
  }
}
