import { LoginStatus } from '../common/enums/login-status.enum';

/**
 * Application representation of wallet.login_history.
 *
 * The database remains the source of truth; this is not an ORM entity.
 */
export interface LoginHistory {
  loginHistoryId: number;
  authUserId: string | null;
  holderAccountId: number | null;
  email: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  loginStatus: LoginStatus;
  failureReason: string | null;
  loginTime: string;
  createdAt: string;
}
