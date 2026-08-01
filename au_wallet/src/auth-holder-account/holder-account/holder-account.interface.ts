import { AccountStatus } from '../common/enums/account-status.enum';

/**
 * Application representation of wallet.holder_account.
 *
 * The database remains the source of truth; this is not an ORM entity.
 */
export interface HolderAccount {
  holderAccountId: number;
  authUserId: string;
  universityEmail: string | null;
  personalEmail: string;
  accountStatus: AccountStatus;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
