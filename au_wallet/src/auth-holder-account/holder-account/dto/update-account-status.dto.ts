import { IsIn } from 'class-validator';
import { AccountStatus } from '../../common/enums/account-status.enum';

export const DIRECTLY_MANAGEABLE_ACCOUNT_STATUSES = [
  AccountStatus.PENDING,
  AccountStatus.REJECTED,
  AccountStatus.SUSPENDED,
] as const;

export class UpdateAccountStatusDto {
  @IsIn(DIRECTLY_MANAGEABLE_ACCOUNT_STATUSES, {
    message:
      'accountStatus can only be set to pending, rejected, or suspended through this endpoint',
  })
  accountStatus!: (typeof DIRECTLY_MANAGEABLE_ACCOUNT_STATUSES)[number];
}
