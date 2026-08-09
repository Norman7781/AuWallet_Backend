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
  const activateAfterConfirmedLogin = jest.fn();
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
      activateAfterConfirmedLogin,
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
    activateAfterConfirmedLogin,
    identifyRole,
    recordSuccess,
    recordLogout,
    recordFailure,
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

  it('returns EMAIL_ALREADY_REGISTERED when a holder already uses the email', async () => {
    const { service, findByPersonalEmail, signUp } = createService();
    findByPersonalEmail.mockResolvedValue({ holderAccountId: 25 });

    await expect(
      service.register({
        firstName: 'Student',
        lastName: 'Example',
        personalEmail: 'student@example.test',
        password: 'Password1',
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account with this email already exists.',
      },
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('maps Supabase duplicate-email codes without exposing its raw message', async () => {
    const { service, findByPersonalEmail, signUp } = createService();
    findByPersonalEmail.mockResolvedValue(null);
    signUp.mockResolvedValue({
      data: { user: null },
      error: {
        code: 'email_exists',
        message: 'raw Supabase duplicate detail',
      },
    });

    await expect(
      service.register({
        firstName: 'Student',
        lastName: 'Example',
        personalEmail: 'student@example.test',
        password: 'Password1',
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account with this email already exists.',
      },
    });
  });

  it('returns a safe registration failure for other Supabase errors', async () => {
    const { service, findByPersonalEmail, signUp } = createService();
    findByPersonalEmail.mockResolvedValue(null);
    signUp.mockResolvedValue({
      data: { user: null },
      error: {
        code: 'unexpected_failure',
        message: 'raw Supabase internal detail',
      },
    });

    await expect(
      service.register({
        firstName: 'Student',
        lastName: 'Example',
        personalEmail: 'student@example.test',
        password: 'Password1',
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        code: 'REGISTRATION_FAILED',
        message: 'Registration could not be completed.',
      },
    });
  });

  it('identifies the login role from app metadata and resolves the holder by email', async () => {
    const {
      service,
      signInWithPassword,
      findByAuthUserId,
      identifyRole,
      recordSuccess,
      activateAfterConfirmedLogin,
    } = createService();
    signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-id',
          email: 'student@example.com',
          email_confirmed_at: '2026-08-09T00:00:00.000Z',
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
    activateAfterConfirmedLogin.mockResolvedValue({
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

  it('activates a pending student on the first confirmed login', async () => {
    const dependencies = createService();
    dependencies.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-id',
          email: 'student@example.test',
          email_confirmed_at: '2026-08-09T00:30:00.000Z',
          app_metadata: { role: 'student' },
        },
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_at: 123456,
        },
      },
      error: null,
    });
    dependencies.identifyRole.mockReturnValue({
      value: UserRole.STUDENT,
      rawValue: 'student',
      source: 'app_metadata',
    });
    dependencies.findByAuthUserId.mockResolvedValue({
      holderAccountId: 25,
      authUserId: 'auth-user-id',
      personalEmail: 'student@example.test',
      accountStatus: AccountStatus.PENDING,
    });
    dependencies.activateAfterConfirmedLogin.mockResolvedValue({
      holderAccountId: 25,
      authUserId: 'auth-user-id',
      personalEmail: 'student@example.test',
      accountStatus: AccountStatus.ACTIVE,
      confirmedAt: '2026-08-09T00:30:00.000Z',
    });

    const response = await dependencies.service.login({
      email: 'student@example.test',
      password: 'Password1',
    });

    expect(dependencies.activateAfterConfirmedLogin).toHaveBeenCalledWith(
      'auth-user-id',
      '2026-08-09T00:30:00.000Z',
    );
    expect(response.data.user.accountStatus).toBe(AccountStatus.ACTIVE);
  });

  it('does not activate a pending holder during refresh', async () => {
    const dependencies = createService();
    dependencies.refreshSession.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-id',
          email: 'student@example.test',
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
    dependencies.identifyRole.mockReturnValue({
      value: UserRole.STUDENT,
      rawValue: 'student',
      source: 'app_metadata',
    });
    dependencies.findByAuthUserId.mockResolvedValue({
      holderAccountId: 25,
      authUserId: 'auth-user-id',
      personalEmail: 'student@example.test',
      accountStatus: AccountStatus.PENDING,
    });

    await expect(
      dependencies.service.refresh('synthetic-refresh-token'),
    ).resolves.toMatchObject({
      data: { user: { accountStatus: AccountStatus.PENDING } },
    });
    expect(dependencies.activateAfterConfirmedLogin).not.toHaveBeenCalled();
  });

  it('maps Supabase email_not_confirmed to EMAIL_NOT_CONFIRMED', async () => {
    const { service, signInWithPassword, recordFailure } = createService();
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        code: 'email_not_confirmed',
        message: 'raw Supabase confirmation detail',
      },
    });

    await expect(
      service.login({
        email: 'student@example.test',
        password: 'Password1',
      }),
    ).rejects.toMatchObject({
      status: 401,
      response: {
        code: 'EMAIL_NOT_CONFIRMED',
        message: 'Confirm your email before logging in.',
      },
    });
    expect(recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ failureReason: 'EMAIL_NOT_CONFIRMED' }),
    );
  });

  it('maps invalid login attempts to INVALID_CREDENTIALS without email enumeration', async () => {
    const { service, signInWithPassword, recordFailure } = createService();
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        code: 'invalid_credentials',
        message: 'raw Supabase credential detail',
      },
    });

    await expect(
      service.login({
        email: 'unknown@example.test',
        password: 'Password1',
      }),
    ).rejects.toMatchObject({
      status: 401,
      response: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    });
    expect(recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ failureReason: 'INVALID_CREDENTIALS' }),
    );
  });

  it('returns ACCOUNT_DISABLED for a rejected holder after valid credentials', async () => {
    const { service, signInWithPassword, findByAuthUserId, identifyRole } =
      createService();
    signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-id',
          email: 'student@example.test',
          app_metadata: { role: 'student' },
        },
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_at: 123456,
        },
      },
      error: null,
    });
    identifyRole.mockReturnValue({ value: UserRole.STUDENT });
    findByAuthUserId.mockResolvedValue({
      holderAccountId: 25,
      accountStatus: AccountStatus.REJECTED,
    });

    await expect(
      service.login({
        email: 'student@example.test',
        password: 'Password1',
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: {
        code: 'ACCOUNT_DISABLED',
        message: 'This account is disabled.',
      },
    });
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

  it('maps an unusable refresh token to REFRESH_TOKEN_INVALID_OR_EXPIRED', async () => {
    const { service, refreshSession } = createService();
    refreshSession.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        code: 'refresh_token_already_used',
        message: 'raw Supabase refresh-token detail',
      },
    });

    await expect(
      service.refresh('unusable-refresh-token'),
    ).rejects.toMatchObject({
      status: 401,
      response: {
        code: 'REFRESH_TOKEN_INVALID_OR_EXPIRED',
        message: 'The refresh token is invalid or expired.',
      },
    });
  });
});
