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
    limit: jest.fn(),
    overrideTypes: jest.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.overrideTypes.mockResolvedValue(response);

  return builder;
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
});
