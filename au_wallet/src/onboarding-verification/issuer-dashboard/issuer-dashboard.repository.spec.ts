import { InternalServerErrorException } from '@nestjs/common';
import type { SupabaseService } from '../../supabase/supabase.service';
import {
  IssuerDashboardRepository,
  RECENT_VERIFICATION_LIMIT,
} from './issuer-dashboard.repository';

interface QueryResponse {
  data: unknown;
  error: unknown;
  count?: number | null;
}

function createQueryBuilder(response: QueryResponse) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    not: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    in: jest.fn(),
    maybeSingle: jest.fn(),
    overrideTypes: jest.fn(),
  };

  for (const method of [
    builder.select,
    builder.eq,
    builder.not,
    builder.order,
    builder.limit,
    builder.in,
    builder.maybeSingle,
  ]) {
    method.mockReturnValue(builder);
  }
  builder.overrideTypes.mockResolvedValue(response);

  return builder;
}

function createRepository(responses: {
  provider: QueryResponse;
  connections?: QueryResponse;
  enrollments?: QueryResponse;
  programs?: QueryResponse;
}) {
  const queries = {
    provider: createQueryBuilder(responses.provider),
    connections: createQueryBuilder(
      responses.connections ?? { data: [], error: null, count: 0 },
    ),
    enrollments: createQueryBuilder(
      responses.enrollments ?? { data: [], error: null },
    ),
    programs: createQueryBuilder(
      responses.programs ?? { data: [], error: null },
    ),
  };
  const from = jest.fn((table: string) => {
    if (table === 'issuer_provider') return queries.provider;
    if (table === 'holder_issuer_connection') return queries.connections;
    if (table === 'student_program_enrollment') return queries.enrollments;
    if (table === 'program') return queries.programs;
    throw new Error(`Unexpected table: ${table}`);
  });
  const schema = jest.fn().mockReturnValue({ from });
  const repository = new IssuerDashboardRepository({
    schema,
  } as unknown as SupabaseService);

  return { repository, queries, schema, from };
}

describe('IssuerDashboardRepository', () => {
  it('returns zero when no AU connection is verified', async () => {
    const { repository, queries, from } = createRepository({
      provider: { data: { issuer_provider_id: 10 }, error: null },
      connections: { data: [], error: null, count: 0 },
    });

    await expect(repository.loadConnectionSummary()).resolves.toEqual({
      verifiedConnectionCount: 0,
      recentVerifications: [],
    });
    expect(queries.connections.eq).toHaveBeenCalledWith(
      'connection_status',
      'verified',
    );
    expect(queries.connections.not).toHaveBeenCalledWith(
      'verified_enrollment_id',
      'is',
      null,
    );
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('counts only verified AU rows and excludes all other connection states', async () => {
    const { repository, queries } = createRepository({
      provider: { data: { issuer_provider_id: 10 }, error: null },
      connections: { data: [], error: null, count: 0 },
    });

    await repository.loadConnectionSummary();

    expect(queries.provider.eq).toHaveBeenCalledWith(
      'issuer_code',
      'assumption-university',
    );
    expect(queries.connections.eq).toHaveBeenCalledWith(
      'issuer_provider_id',
      10,
    );
    expect(queries.connections.eq).toHaveBeenCalledTimes(2);
    expect(queries.connections.eq).not.toHaveBeenCalledWith(
      'connection_status',
      expect.stringMatching(/pending|rejected|disconnected/),
    );
  });

  it('excludes placeholder providers by resolving AU through its exact code', async () => {
    const { repository, queries, from } = createRepository({
      provider: { data: null, error: null },
    });

    await expect(repository.loadConnectionSummary()).resolves.toEqual({
      verifiedConnectionCount: 0,
      recentVerifications: [],
    });
    expect(queries.provider.eq).toHaveBeenCalledWith(
      'issuer_code',
      'assumption-university',
    );
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('returns newest first, limits recent results to 10, and batches program resolution', async () => {
    const connectionRows = Array.from({ length: 12 }, (_, index) => ({
      issuer_provider_id: 10,
      connection_status: 'verified',
      verified_enrollment_id: 100 + index,
      verified_at: new Date(Date.UTC(2026, 7, 9, 9, index)).toISOString(),
    })).reverse();
    const enrollmentRows = connectionRows.map((row) => ({
      enrollment_id: row.verified_enrollment_id,
      program_id: 50,
    }));
    const { repository, queries, schema, from } = createRepository({
      provider: { data: { issuer_provider_id: 10 }, error: null },
      connections: { data: connectionRows, error: null, count: 12 },
      enrollments: { data: enrollmentRows, error: null },
      programs: {
        data: [
          {
            program_id: 50,
            program_code: 'SYN-VMES-CS',
            major: 'Computer Science',
          },
        ],
        error: null,
      },
    });

    const result = await repository.loadConnectionSummary();

    expect(result.verifiedConnectionCount).toBe(12);
    expect(result.recentVerifications).toHaveLength(RECENT_VERIFICATION_LIMIT);
    expect(result.recentVerifications.map((row) => row.verifiedAt)).toEqual(
      [...result.recentVerifications.map((row) => row.verifiedAt)].sort(
        (left, right) => right.localeCompare(left),
      ),
    );
    expect(queries.connections.order).toHaveBeenCalledWith('verified_at', {
      ascending: false,
    });
    expect(queries.connections.limit).toHaveBeenCalledWith(10);
    expect(queries.enrollments.in).toHaveBeenCalledTimes(1);
    expect(queries.programs.in).toHaveBeenCalledTimes(1);
    expect(schema).toHaveBeenCalledTimes(4);
    expect(from).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(result)).not.toMatch(
      /student(Name)?|admission|dateOfBirth|email|passport|hmac|holder(Account)?Id|auth(User)?Id|providerId|connectionId|enrollmentId|transcript/i,
    );
  });

  it('fails with a safe error when program resolution is incomplete', async () => {
    const { repository } = createRepository({
      provider: { data: { issuer_provider_id: 10 }, error: null },
      connections: {
        data: [
          {
            issuer_provider_id: 10,
            connection_status: 'verified',
            verified_enrollment_id: 100,
            verified_at: '2026-08-09T09:00:00.000Z',
          },
        ],
        error: null,
        count: 1,
      },
      enrollments: {
        data: [{ enrollment_id: 100, program_id: 50 }],
        error: null,
      },
      programs: { data: [], error: null },
    });

    await expect(repository.loadConnectionSummary()).rejects.toEqual(
      new InternalServerErrorException(
        'Unable to load issuer connection summary',
      ),
    );
  });
});
