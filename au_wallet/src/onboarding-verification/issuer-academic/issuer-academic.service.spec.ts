import { IssuerAcademicService } from './issuer-academic.service';

describe('IssuerAcademicService', () => {
  const student = {
    studentNumber: '6499002',
    fullName: 'Mr Kawin Rattanakul',
    facultyCode: 'VMES',
    facultyName: 'Vincent Mary School of Engineering, Science and Technology',
    programCode: 'SYN-VMES-CS',
    degreeName: 'Bachelor of Science',
    major: 'Computer Science',
    majorConcentration: null,
    academicStatus: 'graduated',
    graduationDate: '2025-05-24',
    walletEligibility: 'not_verified' as const,
  };

  it('returns the exact program-options envelope', async () => {
    const programs = [
      {
        facultyCode: 'VMES',
        facultyName:
          'Vincent Mary School of Engineering, Science and Technology',
        programCode: 'SYN-VMES-CS',
        degreeName: 'Bachelor of Science',
        major: 'Computer Science',
        majorConcentration: null,
      },
    ];
    const repository = {
      listPrograms: jest.fn().mockResolvedValue(programs),
    };
    const service = new IssuerAcademicService(repository as never);

    await expect(service.listPrograms('VMES')).resolves.toEqual({
      data: { programs },
      message: 'Issuer program options loaded.',
      meta: {},
    });
    expect(repository.listPrograms).toHaveBeenCalledWith('VMES');
  });

  it('returns a paginated student-list envelope', async () => {
    const repository = {
      listStudents: jest.fn().mockResolvedValue({
        students: [student],
        total: 26,
      }),
    };
    const service = new IssuerAcademicService(repository as never);

    await expect(
      service.listStudents({ page: 2, pageSize: 25 }),
    ).resolves.toEqual({
      data: { students: [student] },
      message: 'Issuer students loaded.',
      meta: { page: 2, pageSize: 25, total: 26, totalPages: 2 },
    });
  });

  it('returns the academic-review and preview envelopes', async () => {
    const repository = {
      loadAcademicReview: jest.fn().mockResolvedValue(student),
      loadAcademicPreview: jest.fn().mockResolvedValue({
        studentNumber: '6499002',
        terms: [],
      }),
    };
    const service = new IssuerAcademicService(repository as never);

    await expect(service.getAcademicReview('6499002')).resolves.toEqual({
      data: student,
      message: 'Student academic review loaded.',
      meta: {},
    });
    await expect(service.getAcademicPreview('6499002')).resolves.toEqual({
      data: { studentNumber: '6499002', terms: [] },
      message: 'Student academic preview loaded.',
      meta: {},
    });
  });

  it('returns graduating and wallet eligibility envelopes', async () => {
    const repository = {
      listGraduatingStudents: jest.fn().mockResolvedValue([student]),
      resolveWalletEligibility: jest
        .fn()
        .mockResolvedValue([
          { studentNumber: '6499002', status: 'not_verified' },
        ]),
    };
    const service = new IssuerAcademicService(repository as never);

    await expect(
      service.listGraduatingStudents({
        graduationDate: '2025-05-24',
        facultyCode: 'VMES',
        programCode: 'SYN-VMES-CS',
      }),
    ).resolves.toEqual({
      data: { students: [student] },
      message: 'Graduating students loaded.',
      meta: { total: 1 },
    });
    await expect(
      service.resolveWalletEligibility(['6499002']),
    ).resolves.toEqual({
      data: {
        results: [{ studentNumber: '6499002', status: 'not_verified' }],
      },
      message: 'Wallet eligibility resolved.',
      meta: {},
    });
  });
});
