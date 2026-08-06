import { InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AcademicStudentRepository } from './academic-student.repository';

interface QueryResponse {
  data: unknown;
  error: unknown;
}

function createQueryBuilder(response: QueryResponse) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    limit: jest.fn(),
    overrideTypes: jest.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.overrideTypes.mockResolvedValue(response);

  return builder;
}

function createReviewRepository(responses: Record<string, QueryResponse>) {
  const queries = new Map(
    Object.entries(responses).map(([table, response]) => [
      table,
      createQueryBuilder(response),
    ]),
  );
  const from = jest.fn((table: string) => {
    const query = queries.get(table);

    if (!query) {
      throw new Error(`Unexpected academic table: ${table}`);
    }

    return query;
  });
  const schema = jest.fn().mockReturnValue({ from });
  const repository = new AcademicStudentRepository({
    schema,
  } as unknown as SupabaseService);

  return { repository, queries, from };
}

function createRepository(
  studentResponse: QueryResponse,
  enrollmentResponse: QueryResponse = { data: [], error: null },
) {
  const studentQuery = createQueryBuilder(studentResponse);
  const enrollmentQuery = createQueryBuilder(enrollmentResponse);
  const from = jest.fn((table: string) => {
    if (table === 'student') {
      return studentQuery;
    }

    if (table === 'student_program_enrollment') {
      return enrollmentQuery;
    }

    throw new Error('Unexpected academic table');
  });
  const schema = jest.fn().mockReturnValue({ from });
  const repository = new AcademicStudentRepository({
    schema,
  } as unknown as SupabaseService);

  return { repository, schema, from, studentQuery, enrollmentQuery };
}

describe('AcademicStudentRepository', () => {
  const identity = {
    admissionNo: 'DEMO-ADMISSION-001',
    dateOfBirth: '2001-02-03',
    passportNumberHmac: 'a'.repeat(64),
  };

  it('compares all three identity factors together and resolves enrollments', async () => {
    const { repository, schema, from, studentQuery, enrollmentQuery } =
      createRepository(
        { data: [{ student_id: 11 }], error: null },
        {
          data: [
            {
              student_id: 11,
              enrollment_id: 22,
              academic_status: 'studying',
            },
          ],
          error: null,
        },
      );

    await expect(repository.findExactIdentity(identity)).resolves.toEqual({
      studentMatchCount: 1,
      enrollments: [
        {
          studentId: 11,
          enrollmentId: 22,
          academicStatus: 'studying',
        },
      ],
    });
    expect(schema).toHaveBeenCalledWith('academic');
    expect(from).toHaveBeenNthCalledWith(1, 'student');
    expect(studentQuery.eq).toHaveBeenNthCalledWith(
      1,
      'admission_no',
      identity.admissionNo,
    );
    expect(studentQuery.eq).toHaveBeenNthCalledWith(
      2,
      'date_of_birth',
      identity.dateOfBirth,
    );
    expect(studentQuery.eq).toHaveBeenNthCalledWith(
      3,
      'passport_number_hmac',
      identity.passportNumberHmac,
    );
    expect(from).toHaveBeenNthCalledWith(2, 'student_program_enrollment');
    expect(enrollmentQuery.eq).toHaveBeenCalledWith('student_id', 11);
  });

  it('returns no match without querying enrollment data', async () => {
    const { repository, from } = createRepository({ data: [], error: null });

    await expect(repository.findExactIdentity(identity)).resolves.toEqual({
      studentMatchCount: 0,
      enrollments: [],
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('preserves duplicate student matches for ambiguity handling', async () => {
    const { repository, from } = createRepository({
      data: [{ student_id: 11 }, { student_id: 12 }],
      error: null,
    });

    await expect(repository.findExactIdentity(identity)).resolves.toEqual({
      studentMatchCount: 2,
      enrollments: [],
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('keeps database failures separate from an identity mismatch', async () => {
    const { repository } = createRepository({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(repository.findExactIdentity(identity)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('does not hide enrollment lookup failures as a mismatch', async () => {
    const { repository } = createRepository(
      { data: [{ student_id: 11 }], error: null },
      { data: null, error: { message: 'database unavailable' } },
    );

    await expect(repository.findExactIdentity(identity)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('loads only the limited academic fields needed for issuer review', async () => {
    const { repository, queries } = createReviewRepository({
      student_program_enrollment: {
        data: [
          {
            student_id: 11,
            enrollment_id: 22,
            program_id: 33,
            admission_date: '2023-06-01',
            academic_status: 'alumni',
          },
        ],
        error: null,
      },
      student: {
        data: [
          {
            student_id: 11,
            title: 'Ms.',
            first_name: 'Mali',
            middle_name: null,
            last_name: 'Example',
            admission_no: 'DEMO-STU-0003',
            date_of_birth: '2001-02-03',
          },
        ],
        error: null,
      },
      program: {
        data: [
          {
            program_id: 33,
            degree_name: 'Bachelor of Science',
            major: 'Computer Science',
            major_concentration: 'Information and Data Science',
          },
        ],
        error: null,
      },
      graduation_record: {
        data: [{ enrollment_id: 22, graduation_date: '2026-05-20' }],
        error: null,
      },
    });

    const result = await repository.findReviewContexts([22, 22]);

    expect(result.get(22)).toEqual({
      enrollmentId: 22,
      studentName: 'Ms. Mali Example',
      admissionNo: 'DEMO-STU-0003',
      dateOfBirth: '2001-02-03',
      degreeName: 'Bachelor of Science',
      major: 'Computer Science',
      majorConcentration: 'Information and Data Science',
      admissionDate: '2023-06-01',
      academicStatus: 'alumni',
      officialGraduationDate: '2026-05-20',
    });
    expect(queries.get('student')?.select).toHaveBeenCalledWith(
      expect.not.stringMatching(/passport|email|gpa|grade/i),
    );
    expect(queries.get('student_program_enrollment')?.in).toHaveBeenCalledWith(
      'enrollment_id',
      [22],
    );
  });

  it('fails safely when academic review context is incomplete', async () => {
    const { repository } = createReviewRepository({
      student_program_enrollment: {
        data: [
          {
            student_id: 11,
            enrollment_id: 22,
            program_id: 33,
            admission_date: '2023-06-01',
            academic_status: 'studying',
          },
        ],
        error: null,
      },
      student: { data: null, error: { code: 'DATABASE_UNAVAILABLE' } },
      program: { data: [], error: null },
      graduation_record: { data: [], error: null },
    });

    await expect(repository.findReviewContexts([22])).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
