import { UserRole } from '../enums/role.enum';
import { AccountStatus } from '../enums/account-status.enum';

export interface AuthenticatedUser {
  supabaseAuthId: string;
  holderAccountId: number | null;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus | null;
}
