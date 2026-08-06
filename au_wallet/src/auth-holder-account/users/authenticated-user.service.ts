import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus } from '../common/enums/account-status.enum';
import { SupabaseService } from '../../supabase/supabase.service';
import { UserRole } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { HolderAccountService } from '../holder-account/holder-account.service';
import { RoleService } from '../roles/role.service';
import { AuthUserClaims } from './auth-user-claims.interface';

@Injectable()
export class AuthenticatedUserService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly roleService: RoleService,
    private readonly holderAccountService: HolderAccountService,
  ) {}

  async identify(accessToken: string): Promise<AuthenticatedUser> {
    const token = accessToken.trim();

    if (!token) {
      throw this.accessTokenException();
    }

    const { data, error } = await this.supabase.client.auth.getClaims(token);

    if (error || !data) {
      throw this.accessTokenException();
    }

    const claims = data.claims as AuthUserClaims;
    const supabaseAuthId =
      typeof claims.sub === 'string' ? claims.sub.trim() : '';
    const email =
      typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';

    if (!supabaseAuthId || !email) {
      throw this.accessTokenException();
    }

    const role = this.roleService.identifyRole(claims).value;
    const holderAccount =
      await this.holderAccountService.findByAuthUserId(supabaseAuthId);

    if (role === UserRole.STUDENT && !holderAccount) {
      throw this.accountDisabledException();
    }

    if (
      holderAccount?.accountStatus === AccountStatus.REJECTED ||
      holderAccount?.accountStatus === AccountStatus.SUSPENDED
    ) {
      throw this.accountDisabledException();
    }

    return {
      supabaseAuthId,
      holderAccountId: holderAccount?.holderAccountId ?? null,
      email,
      role,
      accountStatus: holderAccount?.accountStatus ?? null,
    };
  }

  private accessTokenException(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'ACCESS_TOKEN_INVALID_OR_EXPIRED',
      message: 'The access token is missing, invalid, or expired.',
    });
  }

  private accountDisabledException(): ForbiddenException {
    return new ForbiddenException({
      code: 'ACCOUNT_DISABLED',
      message: 'This account is disabled.',
    });
  }
}
