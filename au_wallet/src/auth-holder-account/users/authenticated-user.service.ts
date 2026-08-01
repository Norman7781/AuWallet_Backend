import {
  ForbiddenException,
  Injectable,
  NotFoundException,
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
      throw new UnauthorizedException('An access token is required');
    }

    const { data, error } = await this.supabase.client.auth.getClaims(token);

    if (error || !data) {
      throw new UnauthorizedException('The access token is invalid');
    }

    const claims = data.claims as AuthUserClaims;
    const supabaseAuthId =
      typeof claims.sub === 'string' ? claims.sub.trim() : '';
    const email =
      typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';

    if (!supabaseAuthId || !email) {
      throw new UnauthorizedException(
        'The access token is missing required identity claims',
      );
    }

    const role = this.roleService.identifyRole(claims).value;
    const holderAccount =
      await this.holderAccountService.findByAuthUserId(supabaseAuthId);

    if (role === UserRole.STUDENT && !holderAccount) {
      throw new NotFoundException(
        'No holder account exists for the authenticated student',
      );
    }

    if (
      holderAccount?.accountStatus === AccountStatus.REJECTED ||
      holderAccount?.accountStatus === AccountStatus.SUSPENDED
    ) {
      throw new ForbiddenException(
        `This holder account is ${holderAccount.accountStatus}`,
      );
    }

    return {
      supabaseAuthId,
      holderAccountId: holderAccount?.holderAccountId ?? null,
      email,
      role,
      accountStatus: holderAccount?.accountStatus ?? null,
    };
  }
}
