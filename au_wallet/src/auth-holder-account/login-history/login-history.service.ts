import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { LoginStatus } from '../common/enums/login-status.enum';

@Injectable()
export class LoginHistoryService {
  private readonly logger = new Logger(LoginHistoryService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async recordFailure(payload: {
    email?: string;
    ipAddress?: string;
    userAgent?: string;
    failureReason?: string;
  }): Promise<void> {
    await this.insert({
      email: payload.email,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      loginStatus: LoginStatus.FAILED,
      failureReason: payload.failureReason,
    });
  }

  async recordSuccess(payload: {
    authUserId?: string;
    holderAccountId?: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.insert({
      authUserId: payload.authUserId,
      holderAccountId: payload.holderAccountId,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      loginStatus: LoginStatus.SUCCESS,
    });
  }

  async recordLogout(payload: {
    authUserId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.insert({
      authUserId: payload.authUserId,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      loginStatus: LoginStatus.LOGGED_OUT,
    });
  }

  private async insert(payload: {
    authUserId?: string;
    holderAccountId?: number;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
    loginStatus: LoginStatus;
    failureReason?: string;
  }): Promise<void> {
    const { error } = await this.supabaseService
      .schema('wallet')
      .from('login_history')
      .insert({
        auth_user_id: payload.authUserId ?? null,
        holder_account_id: payload.holderAccountId ?? null,
        email: payload.email ?? null,
        ip_address: payload.ipAddress ?? null,
        user_agent: payload.userAgent ?? null,
        login_status: payload.loginStatus,
        failure_reason: payload.failureReason ?? null,
      });

    if (error) {
      this.logger.error(`Unable to record login history: ${error.code}`);
    }
  }
}
