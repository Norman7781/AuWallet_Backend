import { BadRequestException } from '@nestjs/common';
import { PassportHmacService } from '../security/passport-hmac.service';
import { AcademicStatus } from './academic-student-record.interface';
import { AcademicStudentRepository } from './academic-student.repository';
import { StudentMatchingService } from './student-matching.service';

function enrollment(
  academicStatus: AcademicStatus,
  enrollmentId = 22,
  studentId = 11,
) {
  return { academicStatus, enrollmentId, studentId };
}

function createService() {
  const computePassportHmac = jest.fn().mockReturnValue('a'.repeat(64));
  const findExactIdentity = jest.fn();
  const service = new StudentMatchingService(
    { computePassportHmac } as unknown as PassportHmacService,
    { findExactIdentity } as unknown as AcademicStudentRepository,
  );

  return { service, computePassportHmac, findExactIdentity };
}

describe('StudentMatchingService', () => {
  const input = {
    admissionNo: ' DEMO-ADMISSION-001 ',
    dateOfBirth: ' 2001-02-03 ',
    passportNumber: 'synthetic-passport-input',
  };

  it.each(['studying', 'graduated', 'alumni'] as const)(
    'matches one eligible %s enrollment',
    async (academicStatus) => {
      const { service, computePassportHmac, findExactIdentity } =
        createService();
      findExactIdentity.mockResolvedValue({
        studentMatchCount: 1,
        enrollments: [enrollment(academicStatus)],
      });

      await expect(service.match(input)).resolves.toEqual({
        outcome: 'matched',
        studentId: 11,
        enrollmentId: 22,
        academicStatus,
      });
      expect(computePassportHmac).toHaveBeenCalledWith(input.passportNumber);
      expect(findExactIdentity).toHaveBeenCalledWith({
        admissionNo: 'DEMO-ADMISSION-001',
        dateOfBirth: '2001-02-03',
        passportNumberHmac: 'a'.repeat(64),
      });
    },
  );

  it('returns the protected HMAC only to trusted onboarding orchestration', async () => {
    const { service, findExactIdentity } = createService();
    findExactIdentity.mockResolvedValue({
      studentMatchCount: 1,
      enrollments: [enrollment('studying')],
    });

    await expect(service.prepareAndMatch(input)).resolves.toEqual({
      passportNumberHmac: 'a'.repeat(64),
      result: {
        outcome: 'matched',
        studentId: 11,
        enrollmentId: 22,
        academicStatus: 'studying',
      },
    });
  });

  it.each(['withdrawn', 'suspended'] as const)(
    'classifies one %s enrollment as internally ineligible',
    async (academicStatus) => {
      const { service, findExactIdentity } = createService();
      findExactIdentity.mockResolvedValue({
        studentMatchCount: 1,
        enrollments: [enrollment(academicStatus)],
      });

      await expect(service.match(input)).resolves.toEqual({
        outcome: 'ineligible',
        studentId: 11,
        enrollmentId: 22,
        academicStatus,
      });
    },
  );

  it('returns an unconfirmed result for no exact identity match', async () => {
    const { service, findExactIdentity } = createService();
    findExactIdentity.mockResolvedValue({
      studentMatchCount: 0,
      enrollments: [],
    });

    await expect(service.match(input)).resolves.toEqual({
      outcome: 'under_review',
      reason: 'no_exact_match',
    });
  });

  it('does not choose between multiple matching student records', async () => {
    const { service, findExactIdentity } = createService();
    findExactIdentity.mockResolvedValue({
      studentMatchCount: 2,
      enrollments: [],
    });

    await expect(service.match(input)).resolves.toEqual({
      outcome: 'under_review',
      reason: 'ambiguous_student',
    });
  });

  it('selects the only eligible enrollment when another is ineligible', async () => {
    const { service, findExactIdentity } = createService();
    findExactIdentity.mockResolvedValue({
      studentMatchCount: 1,
      enrollments: [enrollment('withdrawn', 21), enrollment('alumni', 22)],
    });

    await expect(service.match(input)).resolves.toEqual({
      outcome: 'matched',
      studentId: 11,
      enrollmentId: 22,
      academicStatus: 'alumni',
    });
  });

  it('does not choose between multiple eligible enrollments', async () => {
    const { service, findExactIdentity } = createService();
    findExactIdentity.mockResolvedValue({
      studentMatchCount: 1,
      enrollments: [enrollment('studying', 21), enrollment('alumni', 22)],
    });

    await expect(service.match(input)).resolves.toEqual({
      outcome: 'under_review',
      reason: 'ambiguous_enrollment',
    });
  });

  it('returns an unconfirmed result when enrollment data is absent', async () => {
    const { service, findExactIdentity } = createService();
    findExactIdentity.mockResolvedValue({
      studentMatchCount: 1,
      enrollments: [],
    });

    await expect(service.match(input)).resolves.toEqual({
      outcome: 'under_review',
      reason: 'missing_enrollment',
    });
  });

  it('does not convert database failures into a mismatch result', async () => {
    const { service, findExactIdentity } = createService();
    findExactIdentity.mockRejectedValue(new Error('database unavailable'));

    await expect(service.match(input)).rejects.toThrow('database unavailable');
  });

  it('rejects incomplete non-sensitive identity fields before lookup', async () => {
    const { service, computePassportHmac, findExactIdentity } = createService();

    await expect(
      service.match({ ...input, admissionNo: '   ' }),
    ).rejects.toThrow(BadRequestException);
    expect(computePassportHmac).not.toHaveBeenCalled();
    expect(findExactIdentity).not.toHaveBeenCalled();
  });
});
