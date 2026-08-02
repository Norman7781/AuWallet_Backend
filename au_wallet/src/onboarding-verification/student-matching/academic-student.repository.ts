import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  AcademicEnrollmentRecord,
  AcademicIdentityLookup,
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
}
