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
});
