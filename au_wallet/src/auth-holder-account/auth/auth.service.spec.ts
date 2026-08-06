import { SupabaseService } from '../../supabase/supabase.service';
import { AccountStatus } from '../common/enums/account-status.enum';
import { UserRole } from '../common/enums/role.enum';
import { HolderAccountService } from '../holder-account/holder-account.service';
import { LoginHistoryService } from '../login-history/login-history.service';
import { AuthService } from './auth.service';

function createService() {
  const signUp = jest.fn();
  const signInWithPassword = jest.fn();
  const refreshSession = jest.fn();
  const resend = jest.fn();
  const updateUserById = jest.fn();
  const deleteUser = jest.fn();
  const signOut = jest.fn();
  const resetPasswordForEmail = jest.fn();
  const findByPersonalEmail = jest.fn();
  const findByAuthUserId = jest.fn();
  const createPending = jest.fn();
  const identifyRole = jest.fn();
  const recordFailure = jest.fn();
  const recordSuccess = jest.fn();
  const recordLogout = jest.fn();
  const authClient = {
    auth: {
      signUp,
      signInWithPassword,
      refreshSession,
      resend,
      resetPasswordForEmail,
    },
  };

  const service = new AuthService(
    {
      createAuthClient: () => authClient,
      client: {
        auth: {
          admin: { updateUserById, deleteUser, signOut },
        },
      },
    } as unknown as SupabaseService,
    {
      findByPersonalEmail,
      findByAuthUserId,
      createPending,
    } as unknown as HolderAccountService,
    { identifyRole },
    {
      recordFailure,
      recordSuccess,
      recordLogout,
    } as unknown as LoginHistoryService,
  );

  return {
    service,
    signUp,
    signInWithPassword,
    refreshSession,
    resend,
    updateUserById,
    deleteUser,
    signOut,
    findByPersonalEmail,
    findByAuthUserId,
    createPending,
    identifyRole,
    recordSuccess,
    recordLogout,
  };
}

describe('AuthService', () => {
  it('assigns the student role in protected app metadata and creates a pending holder', async () => {
    const {
      service,
      signUp,
      updateUserById,
      findByPersonalEmail,
      createPending,
    } = createService();
    findByPersonalEmail.mockResolvedValue(null);
    signUp.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-id',
          app_metadata: { provider: 'email' },
        },
      },
      error: null,
    });
    updateUserById.mockResolvedValue({ data: {}, error: null });
    createPending.mockResolvedValue({
      holderAccountId: 25,
      accountStatus: AccountStatus.PENDING,
    });

    await expect(
      service.register({
        firstName: 'Student',
        lastName: 'Example',
        personalEmail: 'STUDENT@example.com',
        password: 'Password1',
      }),
    ).resolves.toMatchObject({
      message:
        'Registration successful. Check your email to confirm your account, then return to the wallet and log in.',
      data: {
        authUserId: 'auth-user-id',
        holderAccountId: 25,
        email: 'student@example.com',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.PENDING,
      },
    });
    expect(updateUserById).toHaveBeenCalledWith('auth-user-id', {
      app_metadata: {
        provider: 'email',
        role: UserRole.STUDENT,
      },
    });
    expect(createPending).toHaveBeenCalledWith(
      'auth-user-id',
      'student@example.com',
    );
    expect(signUp).toHaveBeenCalledWith({
      email: 'student@example.com',
      password: 'Password1',
      options: {
        data: {
          first_name: 'Student',
          last_name: 'Example',
        },
      },
    });
  });

  it('resends signup confirmation without supplying a redirect', async () => {
    const { service, resend } = createService();
    resend.mockResolvedValue({ data: {}, error: null });

    await expect(
      service.resendConfirmation('STUDENT@example.test'),
    ).resolves.toMatchObject({
      message:
        'If the account is awaiting confirmation, a new email has been sent.',
    });
    expect(resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'student@example.test',
    });
  });

  it('identifies the login role from app metadata and resolves the holder by email', async () => {
    const {
      service,
      signInWithPassword,
      findByAuthUserId,
      identifyRole,
      recordSuccess,
    } = createService();
    signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-id',
          email: 'student@example.com',
          app_metadata: { role: 'student' },
        },
        session: {
          access_token: 'access-token',
          expires_at: 123456,
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
      holderAccountId: 25,
      authUserId: 'auth-user-id',
      personalEmail: 'student@example.com',
      accountStatus: AccountStatus.ACTIVE,
    });
    recordSuccess.mockResolvedValue(undefined);

    await expect(
      service.login({
        email: 'student@example.com',
        password: 'Password1',
      }),
    ).resolves.toMatchObject({
      data: {
        accessToken: 'access-token',
        user: {
          holderAccountId: 25,
          role: UserRole.STUDENT,
          accountStatus: AccountStatus.ACTIVE,
        },
      },
    });
    expect(findByAuthUserId).toHaveBeenCalledWith('auth-user-id');
  });

  it('removes an Auth user when holder-account creation fails', async () => {
    const {
      service,
      signUp,
      updateUserById,
      createPending,
      deleteUser,
      findByPersonalEmail,
    } = createService();
    findByPersonalEmail.mockResolvedValue(null);
    signUp.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-id',
          app_metadata: {},
        },
      },
      error: null,
    });
    updateUserById.mockResolvedValue({ data: {}, error: null });
    createPending.mockRejectedValue(new Error('database unavailable'));
    deleteUser.mockResolvedValue({ data: {}, error: null });

    await expect(
      service.register({
        firstName: 'Student',
        lastName: 'Example',
        personalEmail: 'student@example.com',
        password: 'Password1',
      }),
    ).rejects.toThrow('database unavailable');
    expect(deleteUser).toHaveBeenCalledWith('auth-user-id');
  });

  it('rotates a refresh token and returns the current protected role', async () => {
    const { service, refreshSession, findByAuthUserId, identifyRole } =
      createService();
    refreshSession.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-id',
          email: 'student@example.com',
          app_metadata: { role: 'student' },
        },
        session: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_at: 123456,
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
      holderAccountId: 25,
      authUserId: 'auth-user-id',
      personalEmail: 'student@example.com',
      accountStatus: AccountStatus.ACTIVE,
    });

    await expect(service.refresh('old-refresh-token')).resolves.toMatchObject({
      data: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          authUserId: 'auth-user-id',
          role: UserRole.STUDENT,
        },
      },
    });
  });
});
