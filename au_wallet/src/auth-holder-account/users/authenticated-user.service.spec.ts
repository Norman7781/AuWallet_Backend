import { SupabaseService } from '../../supabase/supabase.service';
import { AccountStatus } from '../common/enums/account-status.enum';
import { UserRole } from '../common/enums/role.enum';
import { HolderAccountService } from '../holder-account/holder-account.service';
import { AuthenticatedUserService } from './authenticated-user.service';

function createService() {
  const getClaims = jest.fn();
  const identifyRole = jest.fn();
  const findByAuthUserId = jest.fn();
  const service = new AuthenticatedUserService(
    {
      client: { auth: { getClaims } },
    } as unknown as SupabaseService,
    { identifyRole },
    { findByAuthUserId } as unknown as HolderAccountService,
  );

  return { service, getClaims, identifyRole, findByAuthUserId };
}

describe('AuthenticatedUserService', () => {
  it('identifies a verified student and holder account', async () => {
    const { service, getClaims, identifyRole, findByAuthUserId } =
      createService();
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: 'f8daf518-43f1-438f-aa51-8c33480c1024',
          email: 'STUDENT@example.com',
          app_metadata: { role: 'student' },
        },
      },
      error: null,
    });
    identifyRole.mockReturnValue({
      value: UserRole.STUDENT,
      rawValue: 'student',
      source: 'app_metadata',
    });
    findByAuthUserId.mockResolvedValue({
      holderAccountId: 10,
      authUserId: 'f8daf518-43f1-438f-aa51-8c33480c1024',
      universityEmail: null,
      personalEmail: 'student@example.com',
      accountStatus: AccountStatus.ACTIVE,
      confirmedAt: null,
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z',
    });

    await expect(service.identify('valid-token')).resolves.toMatchObject({
      supabaseAuthId: 'f8daf518-43f1-438f-aa51-8c33480c1024',
      holderAccountId: 10,
      email: 'student@example.com',
      role: UserRole.STUDENT,
      accountStatus: AccountStatus.ACTIVE,
    });
  });

  it('rejects an invalid token', async () => {
    const { service, getClaims } = createService();
    getClaims.mockResolvedValue({
      data: null,
      error: { message: 'invalid token' },
    });

    await expect(service.identify('invalid-token')).rejects.toMatchObject({
      status: 401,
      response: {
        code: 'ACCESS_TOKEN_INVALID_OR_EXPIRED',
        message: 'The access token is missing, invalid, or expired.',
      },
    });
  });

  it('returns ACCOUNT_DISABLED when a student has no holder account', async () => {
    const { service, getClaims, identifyRole, findByAuthUserId } =
      createService();
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: 'f8daf518-43f1-438f-aa51-8c33480c1024',
          email: 'student@example.com',
        },
      },
      error: null,
    });
    identifyRole.mockReturnValue({
      value: UserRole.STUDENT,
      source: 'app_metadata',
    });
    findByAuthUserId.mockResolvedValue(null);

    await expect(service.identify('valid-token')).rejects.toMatchObject({
      status: 403,
      response: {
        code: 'ACCOUNT_DISABLED',
        message: 'This account is disabled.',
      },
    });
  });

  it('returns ACCOUNT_DISABLED for a suspended holder', async () => {
    const { service, getClaims, identifyRole, findByAuthUserId } =
      createService();
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: 'f8daf518-43f1-438f-aa51-8c33480c1024',
          email: 'student@example.test',
          app_metadata: { role: 'student' },
        },
      },
      error: null,
    });
    identifyRole.mockReturnValue({ value: UserRole.STUDENT });
    findByAuthUserId.mockResolvedValue({
      holderAccountId: 10,
      accountStatus: AccountStatus.SUSPENDED,
    });

    await expect(service.identify('valid-token')).rejects.toMatchObject({
      status: 403,
      response: {
        code: 'ACCOUNT_DISABLED',
        message: 'This account is disabled.',
      },
    });
  });
});
