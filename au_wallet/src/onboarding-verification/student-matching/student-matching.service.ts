import { BadRequestException, Injectable } from '@nestjs/common';
import { PassportHmacService } from '../security/passport-hmac.service';
import {
  AcademicEnrollmentRecord,
  WalletEligibleAcademicStatus,
  WalletIneligibleAcademicStatus,
} from './academic-student-record.interface';
import { AcademicStudentRepository } from './academic-student.repository';
import {
  PreparedStudentMatch,
  StudentMatchInput,
  StudentMatchResult,
} from './student-match.interface';

const ELIGIBLE_STATUSES = new Set<WalletEligibleAcademicStatus>([
  'studying',
  'graduated',
  'alumni',
]);

@Injectable()
export class StudentMatchingService {
  constructor(
    private readonly passportHmac: PassportHmacService,
    private readonly academicStudents: AcademicStudentRepository,
  ) {}

  async match(input: StudentMatchInput): Promise<StudentMatchResult> {
    const prepared = await this.prepareAndMatch(input);

    return prepared.result;
  }

  async prepareAndMatch(
    input: StudentMatchInput,
  ): Promise<PreparedStudentMatch> {
    const admissionNo = input.admissionNo.trim();
    const dateOfBirth = input.dateOfBirth.trim();

    if (!admissionNo || !dateOfBirth) {
      throw new BadRequestException(
        'Admission number and date of birth are required',
      );
    }

    const passportNumberHmac = this.passportHmac.computePassportHmac(
      input.passportNumber,
    );
    const lookup = await this.academicStudents.findExactIdentity({
      admissionNo,
      dateOfBirth,
      passportNumberHmac,
    });

    const result = this.evaluateLookup(lookup);

    return { passportNumberHmac, result };
  }

  private evaluateLookup(
    lookup: Awaited<ReturnType<AcademicStudentRepository['findExactIdentity']>>,
  ): StudentMatchResult {
    if (lookup.studentMatchCount === 0) {
      return { outcome: 'under_review', reason: 'no_exact_match' };
    }

    if (lookup.studentMatchCount !== 1) {
      return { outcome: 'under_review', reason: 'ambiguous_student' };
    }

    const eligibleEnrollments = lookup.enrollments.filter((enrollment) =>
      ELIGIBLE_STATUSES.has(
        enrollment.academicStatus as WalletEligibleAcademicStatus,
      ),
    );

    if (eligibleEnrollments.length === 1) {
      return this.toMatchedResult(eligibleEnrollments[0]);
    }

    if (eligibleEnrollments.length > 1) {
      return { outcome: 'under_review', reason: 'ambiguous_enrollment' };
    }

    if (lookup.enrollments.length === 0) {
      return { outcome: 'under_review', reason: 'missing_enrollment' };
    }

    if (lookup.enrollments.length > 1) {
      return { outcome: 'under_review', reason: 'ambiguous_enrollment' };
    }

    const enrollment = lookup.enrollments[0];

    return {
      outcome: 'ineligible',
      studentId: enrollment.studentId,
      enrollmentId: enrollment.enrollmentId,
      academicStatus:
        enrollment.academicStatus as WalletIneligibleAcademicStatus,
    };
  }

  private toMatchedResult(
    enrollment: AcademicEnrollmentRecord,
  ): StudentMatchResult {
    return {
      outcome: 'matched',
      studentId: enrollment.studentId,
      enrollmentId: enrollment.enrollmentId,
      academicStatus: enrollment.academicStatus as WalletEligibleAcademicStatus,
    };
  }
}
