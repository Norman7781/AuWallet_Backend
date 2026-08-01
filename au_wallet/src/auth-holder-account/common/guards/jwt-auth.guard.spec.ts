import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUserService } from '../../users/authenticated-user.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const identify = jest.fn();
  const guard = new JwtAuthGuard({
    identify,
  } as unknown as AuthenticatedUserService);

  beforeEach(() => {
    identify.mockReset();
  });

  it('verifies the Bearer token and attaches the identity to the request', async () => {
    const request = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const identity = {
      supabaseAuthId: 'auth-user-id',
      holderAccountId: 25,
      email: 'student@example.com',
      role: 'student',
      accountStatus: 'active',
    };
    identify.mockResolvedValue(identity);
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(identify).toHaveBeenCalledWith('valid-token');
    expect(request).toMatchObject({
      accessToken: 'valid-token',
      user: identity,
    });
  });

  it('rejects requests without a Bearer token', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
