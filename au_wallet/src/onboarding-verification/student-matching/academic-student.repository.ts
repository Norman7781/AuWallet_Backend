import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  AcademicEnrollmentRecord,
  AcademicIdentityLookup,
  AcademicReviewContext,
  AcademicStatus,
  AcademicStudentLookupResult,
} from './academic-student-record.interface';

interface StudentIdRow {
  student_id: number;
}

interface EnrollmentRow {
  student_id: number;
  enrollment_id: number;
  academic_status: AcademicStatus;
}

interface ReviewEnrollmentRow extends EnrollmentRow {
  program_id: number;
  admission_date: string;
}

interface ReviewStudentRow {
  student_id: number;
  title: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  admission_no: string;
  date_of_birth: string;
}

interface ReviewProgramRow {
  program_id: number;
  degree_name: string;
  major: string;
  major_concentration: string | null;
}

interface ReviewGraduationRow {
  enrollment_id: number;
  graduation_date: string;
}

@Injectable()
export class AcademicStudentRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findExactIdentity(
    identity: AcademicIdentityLookup,
  ): Promise<AcademicStudentLookupResult> {
    const { data: students, error: studentError } = await this.supabase
      .schema('academic')
      .from('student')
      .select('student_id')
      .eq('admission_no', identity.admissionNo)
      .eq('date_of_birth', identity.dateOfBirth)
      .eq('passport_number_hmac', identity.passportNumberHmac)
      .limit(2)
      .overrideTypes<StudentIdRow[], { merge: false }>();

    if (studentError) {
      throw new InternalServerErrorException(
        'Unable to verify the academic record',
      );
    }

    const studentRows = students ?? [];

    if (studentRows.length !== 1) {
      return {
        studentMatchCount: studentRows.length,
        enrollments: [],
      };
    }

    const studentId = studentRows[0].student_id;
    const { data: enrollments, error: enrollmentError } = await this.supabase
      .schema('academic')
      .from('student_program_enrollment')
      .select('student_id, enrollment_id, academic_status')
      .eq('student_id', studentId)
      .overrideTypes<EnrollmentRow[], { merge: false }>();

    if (enrollmentError) {
      throw new InternalServerErrorException(
        'Unable to verify the academic record',
      );
    }

    return {
      studentMatchCount: 1,
      enrollments: (enrollments ?? []).map((row): AcademicEnrollmentRecord => ({
        studentId: row.student_id,
        enrollmentId: row.enrollment_id,
        academicStatus: row.academic_status,
      })),
    };
  }

  async findReviewContexts(
    enrollmentIds: number[],
  ): Promise<Map<number, AcademicReviewContext>> {
    const uniqueIds = [...new Set(enrollmentIds)].filter((id) => id > 0);

    if (uniqueIds.length === 0) {
      return new Map();
    }

    const { data: enrollments, error: enrollmentError } = await this.supabase
      .schema('academic')
      .from('student_program_enrollment')
      .select(
        'student_id, enrollment_id, program_id, admission_date, academic_status',
      )
      .in('enrollment_id', uniqueIds)
      .overrideTypes<ReviewEnrollmentRow[], { merge: false }>();

    if (enrollmentError) {
      throw new InternalServerErrorException(
        'Unable to load academic review information',
      );
    }

    const enrollmentRows = enrollments ?? [];

    if (enrollmentRows.length === 0) {
      return new Map();
    }

    const studentIds = [
      ...new Set(enrollmentRows.map((row) => row.student_id)),
    ];
    const programIds = [
      ...new Set(enrollmentRows.map((row) => row.program_id)),
    ];

    const [studentResult, programResult, graduationResult] = await Promise.all([
      this.supabase
        .schema('academic')
        .from('student')
        .select(
          'student_id, title, first_name, middle_name, last_name, admission_no, date_of_birth',
        )
        .in('student_id', studentIds)
        .overrideTypes<ReviewStudentRow[], { merge: false }>(),
      this.supabase
        .schema('academic')
        .from('program')
        .select('program_id, degree_name, major, major_concentration')
        .in('program_id', programIds)
        .overrideTypes<ReviewProgramRow[], { merge: false }>(),
      this.supabase
        .schema('academic')
        .from('graduation_record')
        .select('enrollment_id, graduation_date')
        .in('enrollment_id', uniqueIds)
        .overrideTypes<ReviewGraduationRow[], { merge: false }>(),
    ]);

    if (studentResult.error || programResult.error || graduationResult.error) {
      throw new InternalServerErrorException(
        'Unable to load academic review information',
      );
    }

    const students = new Map(
      (studentResult.data ?? []).map((row) => [row.student_id, row]),
    );
    const programs = new Map(
      (programResult.data ?? []).map((row) => [row.program_id, row]),
    );
    const graduations = new Map(
      (graduationResult.data ?? []).map((row) => [
        row.enrollment_id,
        row.graduation_date,
      ]),
    );
    const contexts = new Map<number, AcademicReviewContext>();

    for (const enrollment of enrollmentRows) {
      const student = students.get(enrollment.student_id);
      const program = programs.get(enrollment.program_id);

      if (!student || !program) {
        continue;
      }

      contexts.set(enrollment.enrollment_id, {
        enrollmentId: enrollment.enrollment_id,
        studentName: [
          student.title,
          student.first_name,
          student.middle_name,
          student.last_name,
        ]
          .filter((part): part is string => Boolean(part))
          .join(' '),
        admissionNo: student.admission_no,
        dateOfBirth: student.date_of_birth,
        degreeName: program.degree_name,
        major: program.major,
        majorConcentration: program.major_concentration,
        admissionDate: enrollment.admission_date,
        academicStatus: enrollment.academic_status,
        officialGraduationDate:
          graduations.get(enrollment.enrollment_id) ?? null,
      });
    }

    return contexts;
  }
}
