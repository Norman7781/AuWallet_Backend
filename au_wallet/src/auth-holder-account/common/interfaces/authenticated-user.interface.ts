import { UserRole } from '../enums/role.enum';
import { AccountStatus } from '../enums/account-status.enum';

export interface AuthenticatedUser {
  userId: string;
  supabaseAuthId: string;
  holderAccountId: number;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
}