import { ConflictException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AccountStatus } from '../common/enums/account-status.enum';
import { HolderAccountService } from './holder-account.service';

describe('HolderAccountService', () => {
  it('rejects direct activation before issuing a database query', async () => {
    const schema = jest.fn();
    const service = new HolderAccountService({
      schema,
    } as unknown as SupabaseService);

    await expect(
      service.updateStatus(12, AccountStatus.ACTIVE),
    ).rejects.toThrow(ConflictException);
    expect(schema).not.toHaveBeenCalled();
  });

  it('activates a pending holder after confirmed login and sets confirmedAt once', async () => {
    const pendingRow = {
      holder_account_id: 12,
      auth_user_id: 'auth-user-id',
      university_email: null,
      personal_email: 'student@example.test',
      account_status: 'pending',
      confirmed_at: null,
      created_at: '2026-08-09T00:00:00.000Z',
      updated_at: '2026-08-09T00:00:00.000Z',
    };
    const activeRow = {
      ...pendingRow,
      account_status: 'active',
      confirmed_at: '2026-08-09T00:30:00.000Z',
    };
    const lookupQuery = createQuery({ data: pendingRow, error: null });
    const updateQuery = createQuery({ data: activeRow, error: null });
    const from = jest
      .fn()
      .mockReturnValueOnce(lookupQuery)
      .mockReturnValueOnce(updateQuery);
    const service = new HolderAccountService({
      schema: jest.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(
      service.activateAfterConfirmedLogin(
        'auth-user-id',
        '2026-08-09T00:30:00.000Z',
      ),
    ).resolves.toMatchObject({
      accountStatus: AccountStatus.ACTIVE,
      confirmedAt: '2026-08-09T00:30:00.000Z',
    });
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        account_status: AccountStatus.ACTIVE,
        confirmed_at: '2026-08-09T00:30:00.000Z',
      }),
    );
    expect(updateQuery.eq).toHaveBeenCalledWith(
      'account_status',
      AccountStatus.PENDING,
    );
  });

  it('is idempotent when the holder is already active', async () => {
    const activeRow = {
      holder_account_id: 12,
      auth_user_id: 'auth-user-id',
      university_email: null,
      personal_email: 'student@example.test',
      account_status: 'active',
      confirmed_at: '2026-08-09T00:30:00.000Z',
      created_at: '2026-08-09T00:00:00.000Z',
      updated_at: '2026-08-09T00:30:00.000Z',
    };
    const query = createQuery({ data: activeRow, error: null });
    const service = new HolderAccountService({
      schema: jest
        .fn()
        .mockReturnValue({ from: jest.fn().mockReturnValue(query) }),
    } as unknown as SupabaseService);

    await expect(
      service.activateAfterConfirmedLogin(
        'auth-user-id',
        '2026-08-09T00:30:00.000Z',
      ),
    ).resolves.toMatchObject({ accountStatus: AccountStatus.ACTIVE });
    expect(query.update).not.toHaveBeenCalled();
  });
});

function createQuery(result: unknown) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    update: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.update.mockReturnValue(query);

  return query;
}
