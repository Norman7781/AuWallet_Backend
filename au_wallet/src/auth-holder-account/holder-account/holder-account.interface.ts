import { AccountStatus } from '../common/enums/account-status.enum';

/**
 * Application representation of wallet.holder_account.
 *
 * The database remains the source of truth; this is not an ORM entity.
 */
export interface HolderAccount {
  holderAccountId: number;
  authUserId: string;
  firstName: string;
  lastName: string;
  /** AU admission number derived only from a verified AU connection. */
  studentId: string | null;
  universityEmail: string | null;
  personalEmail: string;
  accountStatus: AccountStatus;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
