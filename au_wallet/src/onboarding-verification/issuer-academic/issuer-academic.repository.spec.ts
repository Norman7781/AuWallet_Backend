import { ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseService } from '../../supabase/supabase.service';
import { IssuerAcademicRepository } from './issuer-academic.repository';

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
    in: jest.fn(),
    gte: jest.fn(),
    lt: jest.fn(),
    or: jest.fn(),
    order: jest.fn(),
    range: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn(),
    overrideTypes: jest.fn(),
  };

  for (const method of [
    builder.select,
    builder.eq,
    builder.not,
    builder.in,
    builder.gte,
    builder.lt,
    builder.or,
    builder.order,
    builder.range,
    builder.limit,
    builder.maybeSingle,
  ]) {
    method.mockReturnValue(builder);
  }
  builder.overrideTypes.mockResolvedValue(response);

  return builder;
}

function createRepository(
  responses: Record<string, QueryResponse | QueryResponse[]>,
) {
  const queues = new Map(
    Object.entries(responses).map(([table, value]) => [
      table,
      Array.isArray(value) ? [...value] : [value],
    ]),
  );
  const queries: Record<string, ReturnType<typeof createQueryBuilder>[]> = {};
  const from = jest.fn((table: string) => {
    const response = queues.get(table)?.shift();
    if (!response) throw new Error(`Unexpected table query: ${table}`);
    const builder = createQueryBuilder(response);
    queries[table] = [...(queries[table] ?? []), builder];
    return builder;
  });
  const schema = jest.fn().mockReturnValue({ from });

  return {
    repository: new IssuerAcademicRepository({
      schema,
    } as unknown as SupabaseService),
    queries,
    from,
  };
}

const student = {
  student_id: 1,
  admission_no: '6499002',
  title: 'Mr',
  first_name: 'Kawin',
  middle_name: null,
  last_name: 'Rattanakul',
};
const enrollment = {
  enrollment_id: 11,
  student_id: 1,
  program_id: 21,
  admission_date: '2021-06-07',
  academic_status: 'graduated',
};
const program = {
  program_id: 21,
  faculty_code: 'VMES',
  faculty_name: 'Vincent Mary School of Engineering, Science and Technology',
  program_code: 'SYN-VMES-CS',
  degree_name: 'Bachelor of Science',
  major: 'Computer Science',
  major_concentration: null,
  required_credits: '132',
};
const graduation = {
  enrollment_id: 11,
  graduation_date: '2025-05-24',
  graduation_class: 52,
  total_credits_completed: '132',
  total_credits_transferred: '0',
  total_credits_earned: '132',
  cumulative_gpa: '3.59',
  award: null,
  requirements_fulfilled: true,
  graduation_status: 'completed',
};

function studentContextResponses(extra: Record<string, QueryResponse> = {}) {
  return {
    student: { data: student, error: null },
    student_program_enrollment: { data: [enrollment], error: null },
    program: { data: program, error: null },
    graduation_record: { data: graduation, error: null },
    issuer_provider: {
      data: { issuer_provider_id: 31 },
      error: null,
    },
    holder_issuer_connection: {
      data: [{ verified_enrollment_id: 11 }],
      error: null,
    },
    ...extra,
  };
}

describe('IssuerAcademicRepository', () => {
  it('lists active faculty programs with one safe ordered query', async () => {
    const { repository, queries, from } = createRepository({
      program: {
        data: [
          {
            faculty_code: 'VMES',
            faculty_name:
              'Vincent Mary School of Engineering, Science and Technology',
            program_code: 'SYN-VMES-AIT',
            degree_name: 'Bachelor of Science',
            major: 'Applied Informatics',
            major_concentration: 'Information Technology',
          },
          {
            faculty_code: 'VMES',
            faculty_name:
              'Vincent Mary School of Engineering, Science and Technology',
            program_code: 'SYN-VMES-CS',
            degree_name: 'Bachelor of Science',
            major: 'Computer Science',
            major_concentration: null,
          },
        ],
        error: null,
      },
    });

    await expect(repository.listPrograms('VMES')).resolves.toEqual([
      {
        facultyCode: 'VMES',
        facultyName:
          'Vincent Mary School of Engineering, Science and Technology',
        programCode: 'SYN-VMES-AIT',
        degreeName: 'Bachelor of Science',
        major: 'Applied Informatics',
        majorConcentration: 'Information Technology',
      },
      {
        facultyCode: 'VMES',
        facultyName:
          'Vincent Mary School of Engineering, Science and Technology',
        programCode: 'SYN-VMES-CS',
        degreeName: 'Bachelor of Science',
        major: 'Computer Science',
        majorConcentration: null,
      },
    ]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(queries.program[0].eq).toHaveBeenNthCalledWith(
      1,
      'faculty_code',
      'VMES',
    );
    expect(queries.program[0].eq).toHaveBeenNthCalledWith(2, 'is_active', true);
    expect(queries.program[0].order).toHaveBeenCalledWith('major', {
      ascending: true,
    });
    expect(queries.program[0].select).toHaveBeenCalledWith(
      'faculty_code, faculty_name, program_code, degree_name, major, major_concentration',
    );
  });

  it('lists students with pagination and fixed batched relationship queries', async () => {
    const { repository, queries, from } = createRepository({
      student: { data: [student], error: null, count: 1 },
      student_program_enrollment: { data: [enrollment], error: null },
      program: { data: [program], error: null },
      graduation_record: { data: [graduation], error: null },
      issuer_provider: {
        data: { issuer_provider_id: 31 },
        error: null,
      },
      holder_issuer_connection: {
        data: [{ verified_enrollment_id: 11 }],
        error: null,
      },
    });

    const result = await repository.listStudents({
      q: 'Kawin',
      page: 1,
      pageSize: 25,
    });

    expect(result).toEqual({
      total: 1,
      students: [
        expect.objectContaining({
          studentNumber: '6499002',
          fullName: 'Mr Kawin Rattanakul',
          programCode: 'SYN-VMES-CS',
          graduationClass: 52,
          graduationYear: 2025,
          walletEligibility: 'verified',
        }),
      ],
    });
    expect(queries.student[0].range).toHaveBeenCalledWith(0, 24);
    expect(queries.student[0].or).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledTimes(6);
    expect(JSON.stringify(result)).not.toMatch(
      /dateOfBirth|email|passport|hmac|holder(Account)?Id|auth(User)?Id|providerId|connectionId|enrollmentId|did|credential/i,
    );
    const selectedColumns = Object.values(queries)
      .flat()
      .flatMap((query) =>
        (query.select.mock.calls as unknown[][]).map((call) =>
          String(call.at(0)),
        ),
      )
      .join(',');
    expect(selectedColumns).not.toMatch(
      /date_of_birth|email|passport|hmac|holder_account_id|auth_user_id/i,
    );
  });

  it('resolves verified eligibility in batches and hides unknown students', async () => {
    const { repository, from } = createRepository({
      student: {
        data: [{ student_id: 1, admission_no: '6499002' }],
        error: null,
      },
      student_program_enrollment: { data: [enrollment], error: null },
      issuer_provider: {
        data: { issuer_provider_id: 31 },
        error: null,
      },
      holder_issuer_connection: {
        data: [{ verified_enrollment_id: 11 }],
        error: null,
      },
    });

    await expect(
      repository.resolveWalletEligibility(['6499002', '0000000']),
    ).resolves.toEqual([
      { studentNumber: '6499002', status: 'verified' },
      { studentNumber: '0000000', status: 'not_verified' },
    ]);
    expect(from).toHaveBeenCalledTimes(4);
  });

  it('loads one graduation year with one bounded date-range query', async () => {
    const { repository, queries, from } = createRepository({
      program: { data: program, error: null },
      graduation_record: { data: [graduation], error: null },
      student_program_enrollment: { data: [enrollment], error: null },
      student: { data: [student], error: null },
      issuer_provider: {
        data: { issuer_provider_id: 31 },
        error: null,
      },
      holder_issuer_connection: {
        data: [{ verified_enrollment_id: 11 }],
        error: null,
      },
    });

    await expect(
      repository.listGraduatingStudents({
        graduationYear: 2025,
        facultyCode: 'VMES',
        programCode: 'SYN-VMES-CS',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        studentNumber: '6499002',
        graduationDate: '2025-05-24',
        walletEligibility: 'verified',
      }),
    ]);

    expect(queries.graduation_record[0].gte).toHaveBeenCalledWith(
      'graduation_date',
      '2025-01-01',
    );
    expect(queries.graduation_record[0].lt).toHaveBeenCalledWith(
      'graduation_date',
      '2026-01-01',
    );
    expect(queries.graduation_record[0].eq).not.toHaveBeenCalledWith(
      'graduation_date',
      expect.anything(),
    );
    expect(queries.graduation_record[0].limit).toHaveBeenCalledWith(100);
    expect(from).toHaveBeenCalledTimes(6);
  });

  it('loads one graduation month with one bounded date-range query', async () => {
    const { repository, queries } = createRepository({
      program: { data: program, error: null },
      graduation_record: { data: [graduation], error: null },
      student_program_enrollment: { data: [enrollment], error: null },
      student: { data: [student], error: null },
      issuer_provider: {
        data: { issuer_provider_id: 31 },
        error: null,
      },
      holder_issuer_connection: {
        data: [{ verified_enrollment_id: 11 }],
        error: null,
      },
    });

    await expect(
      repository.listGraduatingStudents({
        graduationYear: 2025,
        graduationMonth: 5,
        facultyCode: 'VMES',
        programCode: 'SYN-VMES-CS',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        graduationDate: '2025-05-24',
        graduationClass: 52,
      }),
    ]);

    expect(queries.graduation_record[0].gte).toHaveBeenCalledWith(
      'graduation_date',
      '2025-05-01',
    );
    expect(queries.graduation_record[0].lt).toHaveBeenCalledWith(
      'graduation_date',
      '2025-06-01',
    );
  });

  it('preserves the exact graduation-date query for existing callers', async () => {
    const { repository, queries } = createRepository({
      program: { data: program, error: null },
      graduation_record: { data: [], error: null },
    });

    await expect(
      repository.listGraduatingStudents({
        graduationDate: '2025-05-24',
        facultyCode: 'VMES',
        programCode: 'SYN-VMES-CS',
      }),
    ).resolves.toEqual([]);

    expect(queries.graduation_record[0].eq).toHaveBeenCalledWith(
      'graduation_date',
      '2025-05-24',
    );
    expect(queries.graduation_record[0].gte).not.toHaveBeenCalled();
    expect(queries.graduation_record[0].lt).not.toHaveBeenCalled();
  });

  it('builds a read-only academic preview with term GPA and credits', async () => {
    const { repository } = createRepository(
      studentContextResponses({
        course_result: {
          data: [
            {
              academic_term_id: 41,
              course_id: 51,
              credits: '3',
              grade: 'A',
              result_type: 'normal',
            },
            {
              academic_term_id: 41,
              course_id: 52,
              credits: '3',
              grade: 'B',
              result_type: 'normal',
            },
            {
              academic_term_id: null,
              course_id: 53,
              credits: '3',
              grade: 'TR',
              result_type: 'transfer',
            },
          ],
          error: null,
        },
        course: {
          data: [
            { course_id: 51, course_code: 'CSX1', course_title: 'One' },
            { course_id: 52, course_code: 'CSX2', course_title: 'Two' },
            { course_id: 53, course_code: 'CSX3', course_title: 'Three' },
          ],
          error: null,
        },
        academic_term: {
          data: [
            {
              academic_term_id: 41,
              term_code: '2025/02',
              academic_year: 2025,
              semester_no: 2,
              term_label: 'Academic Year 2025 Semester 2',
            },
          ],
          error: null,
        },
      }),
    );

    const result = await repository.loadAcademicPreview('6499002');

    expect(result.studentNumber).toBe('6499002');
    expect(result.cumulativeGpa).toBe(3.59);
    expect(result.totalEarnedCredits).toBe(132);
    expect(result.transferCredits).toBe(3);
    expect(result.terms[0]).toMatchObject({
      termCode: '2025/02',
      gpa: 3.5,
      earnedCredits: 6,
    });
    expect(result.unassignedResults).toEqual([
      expect.objectContaining({ courseCode: 'CSX3', grade: 'TR' }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /documentNumber|verificationCode|transcriptId|enrollmentId|courseId|termId/i,
    );
  });

  it('returns a safe 503 when academic storage is unavailable', async () => {
    const { repository } = createRepository({
      student: { data: null, error: { message: 'sensitive database error' } },
    });

    await expect(repository.loadAcademicReview('6499002')).rejects.toEqual(
      new ServiceUnavailableException({
        code: 'ISSUER_ACADEMIC_DATA_UNAVAILABLE',
        message: 'Issuer academic data is temporarily unavailable.',
      }),
    );
  });
});
