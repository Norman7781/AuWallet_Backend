import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListGraduatingStudentsDto } from './list-graduating-students.dto';
import { ListIssuerProgramsDto } from './list-issuer-programs.dto';
import { ListIssuerStudentsDto } from './list-issuer-students.dto';
import { ResolveWalletEligibilityDto } from './resolve-wallet-eligibility.dto';

describe('issuer academic DTOs', () => {
  it('requires a constrained faculty code for program options', async () => {
    const valid = plainToInstance(ListIssuerProgramsDto, {
      facultyCode: 'VMES',
    });
    const invalid = plainToInstance(ListIssuerProgramsDto, {
      facultyCode: '*',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });

  it('accepts bounded student pagination and transforms numbers', async () => {
    const dto = plainToInstance(ListIssuerStudentsDto, {
      q: 'Kawin',
      page: '2',
      pageSize: '25',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ q: 'Kawin', page: 2, pageSize: 25 });
  });

  it('rejects unsafe search grammar and oversized pages', async () => {
    const dto = plainToInstance(ListIssuerStudentsDto, {
      q: 'name,passport_number_hmac.eq.anything',
      pageSize: 101,
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('requires exact graduation filters', async () => {
    const valid = plainToInstance(ListGraduatingStudentsDto, {
      graduationDate: '2025-05-24',
      facultyCode: 'VMES',
      programCode: 'SYN-VMES-CS',
    });
    const invalid = plainToInstance(ListGraduatingStudentsDto, {
      graduationDate: 'May 24',
      facultyCode: '*',
      programCode: 'Computer Science',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });

  it('bounds wallet resolution and validates every student number', async () => {
    const valid = plainToInstance(ResolveWalletEligibilityDto, {
      studentNumbers: ['6499002', 'DEMO-STU-0001'],
    });
    const invalid = plainToInstance(ResolveWalletEligibilityDto, {
      studentNumbers: ['6499002', 'bad value'],
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
