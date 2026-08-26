import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { ASSUMPTION_UNIVERSITY_ISSUER_CODE } from '../issuer-connections/issuer-connection.service';
import type {
  AcademicPreview,
  AcademicPreviewCourse,
  AcademicPreviewTerm,
  AcademicReview,
  IssuerProgramOption,
  IssuerStudentSummary,
  WalletEligibility,
} from './issuer-academic.interface';

interface StudentRow {
  student_id: number;
  admission_no: string;
  title: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
}

interface EnrollmentRow {
  enrollment_id: number;
  student_id: number;
  program_id: number;
  admission_date: string;
  academic_status: string;
}

interface ProgramRow {
  program_id: number;
  faculty_code: string;
  faculty_name: string;
  program_code: string;
  degree_name: string;
  major: string;
  major_concentration: string | null;
  required_credits: number | string;
}

type ProgramOptionRow = Omit<ProgramRow, 'program_id' | 'required_credits'>;

interface GraduationRow {
  enrollment_id: number;
  graduation_date: string | null;
  graduation_class: number | null;
  total_credits_completed: number | string;
  total_credits_transferred: number | string;
  total_credits_earned: number | string;
  cumulative_gpa: number | string | null;
  award: string | null;
  requirements_fulfilled: boolean;
  graduation_status: string;
}

interface ProviderRow {
  issuer_provider_id: number;
}

interface ConnectionRow {
  verified_enrollment_id: number;
}

interface CourseResultRow {
  academic_term_id: number | null;
  course_id: number;
  credits: number | string;
  grade: string;
  result_type: string;
}

interface CourseRow {
  course_id: number;
  course_code: string;
  course_title: string;
}

interface AcademicTermRow {
  academic_term_id: number;
  term_code: string;
  academic_year: number;
  semester_no: number;
  term_label: string;
}

interface LoadedStudentContext {
  student: StudentRow;
  enrollment: EnrollmentRow;
  program: ProgramRow;
  graduation: GraduationRow | null;
  walletEligibility: WalletEligibility;
}

const GRADE_POINTS: Readonly<Record<string, number>> = {
  A: 4,
  'A-': 3.75,
  'B+': 3.25,
  B: 3,
  'B-': 2.75,
  'C+': 2.25,
  C: 2,
};

@Injectable()
export class IssuerAcademicRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listPrograms(facultyCode: string): Promise<IssuerProgramOption[]> {
    const { data, error } = await this.supabase
      .schema('academic')
      .from('program')
      .select(
        'faculty_code, faculty_name, program_code, degree_name, major, major_concentration',
      )
      .eq('faculty_code', facultyCode)
      .eq('is_active', true)
      .order('major', { ascending: true })
      .overrideTypes<ProgramOptionRow[], { merge: false }>();

    if (error) this.fail();

    return (data ?? []).map((program) => ({
      facultyCode: program.faculty_code,
      facultyName: program.faculty_name,
      programCode: program.program_code,
      degreeName: program.degree_name,
      major: program.major,
      majorConcentration: program.major_concentration,
    }));
  }

  async listStudents(input: {
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<{ students: IssuerStudentSummary[]; total: number }> {
    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;
    let query = this.supabase
      .schema('academic')
      .from('student')
      .select(
        'student_id, admission_no, title, first_name, middle_name, last_name',
        { count: 'exact' },
      )
      .order('admission_no', { ascending: true })
      .range(from, to);

    if (input.q) {
      const pattern = `%${input.q.trim()}%`;
      query = query.or(
        `admission_no.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`,
      );
    }

    const { data, error, count } = await query.overrideTypes<
      StudentRow[],
      { merge: false }
    >();

    if (error || count === null) this.fail();

    return {
      students: await this.loadStudentSummaries(data ?? []),
      total: count,
    };
  }

  async loadAcademicReview(studentNumber: string): Promise<AcademicReview> {
    const context = await this.loadStudentContext(studentNumber);
    const summary = this.toSummary(context);
    const graduation = context.graduation;

    return {
      ...summary,
      admissionDate: context.enrollment.admission_date,
      requiredCredits: this.toNumber(context.program.required_credits),
      creditSummary: {
        completed: graduation
          ? this.toNumber(graduation.total_credits_completed)
          : null,
        transferred: graduation
          ? this.toNumber(graduation.total_credits_transferred)
          : null,
        earned: graduation
          ? this.toNumber(graduation.total_credits_earned)
          : null,
      },
      cumulativeGpa:
        graduation?.cumulative_gpa === null || graduation === null
          ? null
          : this.toNumber(graduation.cumulative_gpa),
      graduationStatus: graduation?.graduation_status ?? null,
      requirementsFulfilled: graduation?.requirements_fulfilled ?? null,
      award: graduation?.award ?? null,
    };
  }

  async loadAcademicPreview(studentNumber: string): Promise<AcademicPreview> {
    const context = await this.loadStudentContext(studentNumber);
    const { data, error } = await this.supabase
      .schema('academic')
      .from('course_result')
      .select('academic_term_id, course_id, credits, grade, result_type')
      .eq('enrollment_id', context.enrollment.enrollment_id)
      .overrideTypes<CourseResultRow[], { merge: false }>();

    if (error) this.fail();

    const results = data ?? [];
    const courseIds = [...new Set(results.map((row) => row.course_id))];
    const termIds = [
      ...new Set(
        results
          .map((row) => row.academic_term_id)
          .filter((id): id is number => id !== null),
      ),
    ];

    const [courseResult, termResult] = await Promise.all([
      courseIds.length === 0
        ? Promise.resolve({ data: [] as CourseRow[], error: null })
        : this.supabase
            .schema('academic')
            .from('course')
            .select('course_id, course_code, course_title')
            .in('course_id', courseIds)
            .overrideTypes<CourseRow[], { merge: false }>(),
      termIds.length === 0
        ? Promise.resolve({ data: [] as AcademicTermRow[], error: null })
        : this.supabase
            .schema('academic')
            .from('academic_term')
            .select(
              'academic_term_id, term_code, academic_year, semester_no, term_label',
            )
            .in('academic_term_id', termIds)
            .overrideTypes<AcademicTermRow[], { merge: false }>(),
    ]);

    if (courseResult.error || termResult.error) this.fail();

    return this.toAcademicPreview(
      context,
      results,
      courseResult.data ?? [],
      termResult.data ?? [],
    );
  }

  async listGraduatingStudents(input: {
    graduationDate?: string;
    graduationYear?: number;
    graduationMonth?: number;
    facultyCode: string;
    programCode: string;
  }): Promise<IssuerStudentSummary[]> {
    const { data: program, error: programError } = await this.supabase
      .schema('academic')
      .from('program')
      .select(
        'program_id, faculty_code, faculty_name, program_code, degree_name, major, major_concentration, required_credits',
      )
      .eq('faculty_code', input.facultyCode)
      .eq('program_code', input.programCode)
      .maybeSingle()
      .overrideTypes<ProgramRow | null, { merge: false }>();

    if (programError) this.fail();
    if (!program) return [];

    const graduationQuery = this.supabase
      .schema('academic')
      .from('graduation_record')
      .select(
        'enrollment_id, graduation_date, graduation_class, total_credits_completed, total_credits_transferred, total_credits_earned, cumulative_gpa, award, requirements_fulfilled, graduation_status',
      );
    let filteredGraduationQuery = graduationQuery;
    if (input.graduationDate) {
      filteredGraduationQuery = graduationQuery.eq(
        'graduation_date',
        input.graduationDate,
      );
    } else if (input.graduationMonth) {
      const year = input.graduationYear!;
      const month = input.graduationMonth;
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonth = month === 12 ? 1 : month + 1;
      const paddedMonth = String(month).padStart(2, '0');
      const paddedNextMonth = String(nextMonth).padStart(2, '0');
      filteredGraduationQuery = graduationQuery
        .gte('graduation_date', `${year}-${paddedMonth}-01`)
        .lt('graduation_date', `${nextYear}-${paddedNextMonth}-01`);
    } else {
      const year = input.graduationYear!;
      filteredGraduationQuery = graduationQuery
        .gte('graduation_date', `${year}-01-01`)
        .lt('graduation_date', `${year + 1}-01-01`);
    }
    const { data: graduations, error: graduationError } =
      await filteredGraduationQuery
        .limit(100)
        .overrideTypes<GraduationRow[], { merge: false }>();

    if (graduationError) this.fail();

    const graduationRows = graduations ?? [];
    if (graduationRows.length === 0) return [];

    const enrollmentIds = graduationRows.map((row) => row.enrollment_id);
    const { data: enrollments, error: enrollmentError } = await this.supabase
      .schema('academic')
      .from('student_program_enrollment')
      .select(
        'enrollment_id, student_id, program_id, admission_date, academic_status',
      )
      .eq('program_id', program.program_id)
      .in('enrollment_id', enrollmentIds)
      .overrideTypes<EnrollmentRow[], { merge: false }>();

    if (enrollmentError) this.fail();

    const enrollmentRows = enrollments ?? [];
    if (enrollmentRows.length === 0) return [];

    const { data: students, error: studentError } = await this.supabase
      .schema('academic')
      .from('student')
      .select(
        'student_id, admission_no, title, first_name, middle_name, last_name',
      )
      .in(
        'student_id',
        enrollmentRows.map((row) => row.student_id),
      )
      .overrideTypes<StudentRow[], { merge: false }>();

    if (studentError) this.fail();

    const graduationsByEnrollment = new Map(
      graduationRows.map((row) => [row.enrollment_id, row]),
    );
    const enrollmentsByStudent = new Map(
      enrollmentRows.map((row) => [row.student_id, row]),
    );
    const eligibility = await this.loadWalletEligibility(
      enrollmentRows.map((row) => row.enrollment_id),
    );

    return (students ?? [])
      .map((student): IssuerStudentSummary | null => {
        const enrollment = enrollmentsByStudent.get(student.student_id);
        if (!enrollment) return null;

        return this.toSummary({
          student,
          enrollment,
          program,
          graduation:
            graduationsByEnrollment.get(enrollment.enrollment_id) ?? null,
          walletEligibility:
            eligibility.get(enrollment.enrollment_id) ?? 'not_verified',
        });
      })
      .filter((row): row is IssuerStudentSummary => row !== null)
      .sort((left, right) =>
        left.studentNumber.localeCompare(right.studentNumber),
      );
  }

  async resolveWalletEligibility(
    studentNumbers: string[],
  ): Promise<Array<{ studentNumber: string; status: WalletEligibility }>> {
    const uniqueNumbers = [...new Set(studentNumbers)];
    const { data: students, error: studentError } = await this.supabase
      .schema('academic')
      .from('student')
      .select('student_id, admission_no')
      .in('admission_no', uniqueNumbers)
      .overrideTypes<
        Array<Pick<StudentRow, 'student_id' | 'admission_no'>>,
        { merge: false }
      >();

    if (studentError) this.fail();

    const studentRows = students ?? [];
    const { data: enrollments, error: enrollmentError } =
      studentRows.length === 0
        ? { data: [] as EnrollmentRow[], error: null }
        : await this.supabase
            .schema('academic')
            .from('student_program_enrollment')
            .select(
              'enrollment_id, student_id, program_id, admission_date, academic_status',
            )
            .in(
              'student_id',
              studentRows.map((row) => row.student_id),
            )
            .overrideTypes<EnrollmentRow[], { merge: false }>();

    if (enrollmentError) this.fail();

    const enrollmentRows = enrollments ?? [];
    const eligibility = await this.loadWalletEligibility(
      enrollmentRows.map((row) => row.enrollment_id),
    );
    const enrollmentByStudent = new Map(
      enrollmentRows.map((row) => [row.student_id, row.enrollment_id]),
    );
    const statusByNumber = new Map<string, WalletEligibility>();

    for (const student of studentRows) {
      const enrollmentId = enrollmentByStudent.get(student.student_id);
      statusByNumber.set(
        student.admission_no,
        enrollmentId === undefined
          ? 'not_verified'
          : (eligibility.get(enrollmentId) ?? 'not_verified'),
      );
    }

    return uniqueNumbers.map((studentNumber) => ({
      studentNumber,
      status: statusByNumber.get(studentNumber) ?? 'not_verified',
    }));
  }

  private async loadStudentSummaries(
    students: StudentRow[],
  ): Promise<IssuerStudentSummary[]> {
    if (students.length === 0) return [];

    const { data: enrollments, error: enrollmentError } = await this.supabase
      .schema('academic')
      .from('student_program_enrollment')
      .select(
        'enrollment_id, student_id, program_id, admission_date, academic_status',
      )
      .in(
        'student_id',
        students.map((row) => row.student_id),
      )
      .order('admission_date', { ascending: false })
      .overrideTypes<EnrollmentRow[], { merge: false }>();

    if (enrollmentError) this.fail();

    const enrollmentRows = this.latestEnrollmentPerStudent(enrollments ?? []);
    const programIds = [
      ...new Set(enrollmentRows.map((row) => row.program_id)),
    ];
    const enrollmentIds = enrollmentRows.map((row) => row.enrollment_id);
    const [programResult, graduationResult, eligibility] = await Promise.all([
      this.supabase
        .schema('academic')
        .from('program')
        .select(
          'program_id, faculty_code, faculty_name, program_code, degree_name, major, major_concentration, required_credits',
        )
        .in('program_id', programIds)
        .overrideTypes<ProgramRow[], { merge: false }>(),
      this.supabase
        .schema('academic')
        .from('graduation_record')
        .select(
          'enrollment_id, graduation_date, graduation_class, total_credits_completed, total_credits_transferred, total_credits_earned, cumulative_gpa, award, requirements_fulfilled, graduation_status',
        )
        .in('enrollment_id', enrollmentIds)
        .overrideTypes<GraduationRow[], { merge: false }>(),
      this.loadWalletEligibility(enrollmentIds),
    ]);

    if (programResult.error || graduationResult.error) this.fail();

    const enrollmentByStudent = new Map(
      enrollmentRows.map((row) => [row.student_id, row]),
    );
    const programById = new Map(
      (programResult.data ?? []).map((row) => [row.program_id, row]),
    );
    const graduationByEnrollment = new Map(
      (graduationResult.data ?? []).map((row) => [row.enrollment_id, row]),
    );

    return students
      .map((student): IssuerStudentSummary | null => {
        const enrollment = enrollmentByStudent.get(student.student_id);
        if (!enrollment) return null;
        const program = programById.get(enrollment.program_id);
        if (!program) return null;

        return this.toSummary({
          student,
          enrollment,
          program,
          graduation:
            graduationByEnrollment.get(enrollment.enrollment_id) ?? null,
          walletEligibility:
            eligibility.get(enrollment.enrollment_id) ?? 'not_verified',
        });
      })
      .filter((row): row is IssuerStudentSummary => row !== null);
  }

  private async loadStudentContext(
    studentNumber: string,
  ): Promise<LoadedStudentContext> {
    const { data: student, error: studentError } = await this.supabase
      .schema('academic')
      .from('student')
      .select(
        'student_id, admission_no, title, first_name, middle_name, last_name',
      )
      .eq('admission_no', studentNumber)
      .maybeSingle()
      .overrideTypes<StudentRow | null, { merge: false }>();

    if (studentError) this.fail();
    if (!student) this.notFound();

    const { data: enrollments, error: enrollmentError } = await this.supabase
      .schema('academic')
      .from('student_program_enrollment')
      .select(
        'enrollment_id, student_id, program_id, admission_date, academic_status',
      )
      .eq('student_id', student.student_id)
      .order('admission_date', { ascending: false })
      .limit(1)
      .overrideTypes<EnrollmentRow[], { merge: false }>();

    if (enrollmentError) this.fail();
    const enrollment = enrollments?.[0];
    if (!enrollment) this.notFound();

    const [programResult, graduationResult, eligibility] = await Promise.all([
      this.supabase
        .schema('academic')
        .from('program')
        .select(
          'program_id, faculty_code, faculty_name, program_code, degree_name, major, major_concentration, required_credits',
        )
        .eq('program_id', enrollment.program_id)
        .maybeSingle()
        .overrideTypes<ProgramRow | null, { merge: false }>(),
      this.supabase
        .schema('academic')
        .from('graduation_record')
        .select(
          'enrollment_id, graduation_date, graduation_class, total_credits_completed, total_credits_transferred, total_credits_earned, cumulative_gpa, award, requirements_fulfilled, graduation_status',
        )
        .eq('enrollment_id', enrollment.enrollment_id)
        .maybeSingle()
        .overrideTypes<GraduationRow | null, { merge: false }>(),
      this.loadWalletEligibility([enrollment.enrollment_id]),
    ]);

    if (programResult.error || graduationResult.error) this.fail();
    if (!programResult.data) this.notFound();

    return {
      student,
      enrollment,
      program: programResult.data,
      graduation: graduationResult.data,
      walletEligibility:
        eligibility.get(enrollment.enrollment_id) ?? 'not_verified',
    };
  }

  private async loadWalletEligibility(
    enrollmentIds: number[],
  ): Promise<Map<number, WalletEligibility>> {
    const output = new Map<number, WalletEligibility>();
    for (const enrollmentId of enrollmentIds) {
      output.set(enrollmentId, 'not_verified');
    }

    if (enrollmentIds.length === 0) return output;

    const { data: provider, error: providerError } = await this.supabase
      .schema('wallet')
      .from('issuer_provider')
      .select('issuer_provider_id')
      .eq('issuer_code', ASSUMPTION_UNIVERSITY_ISSUER_CODE)
      .maybeSingle()
      .overrideTypes<ProviderRow | null, { merge: false }>();

    if (providerError) this.fail();
    if (!provider) return output;

    const { data, error } = await this.supabase
      .schema('wallet')
      .from('holder_issuer_connection')
      .select('verified_enrollment_id')
      .eq('issuer_provider_id', provider.issuer_provider_id)
      .eq('connection_status', 'verified')
      .not('verified_enrollment_id', 'is', null)
      .in('verified_enrollment_id', [...new Set(enrollmentIds)])
      .overrideTypes<ConnectionRow[], { merge: false }>();

    if (error) this.fail();

    for (const connection of data ?? []) {
      output.set(connection.verified_enrollment_id, 'verified');
    }

    return output;
  }

  private latestEnrollmentPerStudent(rows: EnrollmentRow[]): EnrollmentRow[] {
    const latest = new Map<number, EnrollmentRow>();
    for (const row of rows) {
      if (!latest.has(row.student_id)) latest.set(row.student_id, row);
    }
    return [...latest.values()];
  }

  private toSummary(context: LoadedStudentContext): IssuerStudentSummary {
    return {
      studentNumber: context.student.admission_no,
      fullName: [
        context.student.title,
        context.student.first_name,
        context.student.middle_name,
        context.student.last_name,
      ]
        .filter((part): part is string => Boolean(part))
        .join(' '),
      facultyCode: context.program.faculty_code,
      facultyName: context.program.faculty_name,
      programCode: context.program.program_code,
      degreeName: context.program.degree_name,
      major: context.program.major,
      majorConcentration: context.program.major_concentration,
      academicStatus: context.enrollment.academic_status,
      graduationDate: context.graduation?.graduation_date ?? null,
      graduationClass: context.graduation?.graduation_class ?? null,
      walletEligibility: context.walletEligibility,
    };
  }

  private toAcademicPreview(
    context: LoadedStudentContext,
    results: CourseResultRow[],
    courses: CourseRow[],
    terms: AcademicTermRow[],
  ): AcademicPreview {
    const courseById = new Map(courses.map((row) => [row.course_id, row]));
    const termById = new Map(terms.map((row) => [row.academic_term_id, row]));
    const grouped = new Map<
      number,
      Array<{ row: CourseResultRow; course: AcademicPreviewCourse }>
    >();
    const unassignedResults: AcademicPreviewCourse[] = [];

    for (const row of results) {
      const course = courseById.get(row.course_id);
      if (!course) this.fail();
      const item: AcademicPreviewCourse = {
        courseCode: course.course_code,
        courseTitle: course.course_title,
        credits: this.toNumber(row.credits),
        grade: row.grade,
        resultType: row.result_type,
      };

      if (row.academic_term_id === null) {
        unassignedResults.push(item);
        continue;
      }

      const existing = grouped.get(row.academic_term_id) ?? [];
      existing.push({ row, course: item });
      grouped.set(row.academic_term_id, existing);
    }

    const previewTerms: AcademicPreviewTerm[] = [...grouped.entries()]
      .map(([termId, items]) => {
        const term = termById.get(termId);
        if (!term) this.fail();
        const gpa = this.calculateGpa(items.map((item) => item.row));

        return {
          termCode: term.term_code,
          termLabel: term.term_label,
          academicYear: term.academic_year,
          semesterNo: term.semester_no,
          gpa,
          earnedCredits: items
            .filter((item) => this.isEarned(item.row))
            .reduce((sum, item) => sum + this.toNumber(item.row.credits), 0),
          courses: items
            .map((item) => item.course)
            .sort((left, right) =>
              left.courseCode.localeCompare(right.courseCode),
            ),
        };
      })
      .sort((left, right) => right.termCode.localeCompare(left.termCode));

    const calculatedGpa = this.calculateGpa(results);
    const calculatedEarnedCredits = results
      .filter((row) => this.isEarned(row))
      .reduce((sum, row) => sum + this.toNumber(row.credits), 0);
    const transferCredits = results
      .filter((row) => row.result_type === 'transfer')
      .reduce((sum, row) => sum + this.toNumber(row.credits), 0);

    return {
      studentNumber: context.student.admission_no,
      cumulativeGpa:
        context.graduation?.cumulative_gpa === null || !context.graduation
          ? calculatedGpa
          : this.toNumber(context.graduation.cumulative_gpa),
      totalEarnedCredits: context.graduation
        ? this.toNumber(context.graduation.total_credits_earned)
        : calculatedEarnedCredits,
      transferCredits,
      terms: previewTerms,
      unassignedResults: unassignedResults.sort((left, right) =>
        left.courseCode.localeCompare(right.courseCode),
      ),
    };
  }

  private calculateGpa(rows: CourseResultRow[]): number | null {
    let credits = 0;
    let points = 0;

    for (const row of rows) {
      if (row.result_type !== 'normal') continue;
      const gradePoints = GRADE_POINTS[row.grade];
      if (gradePoints === undefined) continue;
      const rowCredits = this.toNumber(row.credits);
      credits += rowCredits;
      points += rowCredits * gradePoints;
    }

    return credits === 0 ? null : Math.round((points / credits) * 100) / 100;
  }

  private isEarned(row: CourseResultRow): boolean {
    return !['F', 'U', 'W'].includes(row.grade);
  }

  private toNumber(value: number | string): number {
    const number = Number(value);
    if (!Number.isFinite(number)) this.fail();
    return number;
  }

  private notFound(): never {
    throw new NotFoundException({
      code: 'ISSUER_STUDENT_NOT_FOUND',
      message: 'The requested student record was not found.',
    });
  }

  private fail(): never {
    throw new ServiceUnavailableException({
      code: 'ISSUER_ACADEMIC_DATA_UNAVAILABLE',
      message: 'Issuer academic data is temporarily unavailable.',
    });
  }
}
