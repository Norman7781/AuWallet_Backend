import { validate } from 'class-validator';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { UpdateAccountStatusDto } from './update-account-status.dto';

describe('UpdateAccountStatusDto', () => {
  it.each([
    AccountStatus.PENDING,
    AccountStatus.REJECTED,
    AccountStatus.SUSPENDED,
  ])('accepts direct transition to %s', async (accountStatus) => {
    const dto = new UpdateAccountStatusDto();
    dto.accountStatus = accountStatus;

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects direct activation', async () => {
    const dto = new UpdateAccountStatusDto();
    Object.assign(dto, { accountStatus: AccountStatus.ACTIVE });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
