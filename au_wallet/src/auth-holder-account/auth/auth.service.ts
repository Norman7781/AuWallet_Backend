import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import type { HolderAccount } from '../holder-account/holder-account.interface';
import { HolderAccountService } from '../holder-account/holder-account.service';
import { RoleService } from '../roles/role.service';
import { LoginHistoryService } from '../login-history/login-history.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

import { UserRole } from '../common/enums/role.enum';
import { AccountStatus } from '../common/enums/account-status.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly holderAccountService: HolderAccountService,
    private readonly rolesService: RoleService,
    private readonly loginHistoryService: LoginHistoryService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.personalEmail.trim().toLowerCase();

    const existingHolder =
      await this.holderAccountService.findByPersonalEmail(email);

    if (existingHolder) {
      throw new ConflictException('An account with this email already exists');
    }

    const authClient = this.supabaseService.createAuthClient();
    const adminClient = this.supabaseService.client;

    const { data, error } = await authClient.auth.signUp({
      email,
      password: dto.password,
      options: {
        data: {
          first_name: dto.firstName.trim(),
          last_name: dto.lastName.trim(),
        },
        emailRedirectTo:
          process.env.EMAIL_CONFIRMATION_REDIRECT_URL || undefined,
      },
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!data.user) {
      throw new BadRequestException(
        'Supabase authentication user was not created',
      );
    }

    if (data.user.identities?.length === 0) {
      throw new ConflictException('An account with this email already exists');
    }

    let holderAccount: HolderAccount;

    try {
      const { error: roleAssignmentError } =
        await adminClient.auth.admin.updateUserById(data.user.id, {
          app_metadata: {
            ...data.user.app_metadata,
            role: UserRole.STUDENT,
          },
        });

      if (roleAssignmentError) {
        throw new InternalServerErrorException(
          'Registration could not be completed',
        );
      }

      holderAccount = await this.holderAccountService.createPending(
        data.user.id,
        email,
      );
    } catch (error) {
      await adminClient.auth.admin.deleteUser(data.user.id);
      throw error;
    }

    return {
      message: 'Registration successful. Please verify your email.',
      data: {
        authUserId: data.user.id,
        holderAccountId: holderAccount.holderAccountId,
        email,
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.PENDING,
      },
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const email = dto.email.trim().toLowerCase();
    const authClient = this.supabaseService.createAuthClient();

    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password: dto.password,
    });

    if (error || !data.user || !data.session) {
      await this.loginHistoryService.recordFailure({
        email,
        ipAddress,
        userAgent,
        failureReason: 'INVALID_CREDENTIALS',
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    const role = this.rolesService.identifyRole({
      sub: data.user.id,
      email: data.user.email,
      app_metadata: data.user.app_metadata,
    }).value;
    const holder = await this.holderAccountService.findByAuthUserId(
      data.user.id,
    );

    if (role === UserRole.STUDENT && !holder) {
      throw new UnauthorizedException('Holder account was not found');
    }

    if (
      holder?.accountStatus === AccountStatus.REJECTED ||
      holder?.accountStatus === AccountStatus.SUSPENDED
    ) {
      throw new UnauthorizedException(
        `This account is ${holder.accountStatus}`,
      );
    }

    await this.loginHistoryService.recordSuccess({
      authUserId: data.user.id,
      holderAccountId: holder?.holderAccountId,
      ipAddress,
      userAgent,
    });

    return {
      message: 'Login successful',
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        user: {
          authUserId: data.user.id,
          holderAccountId: holder?.holderAccountId ?? null,
          email: data.user.email ?? email,
          role,
          accountStatus: holder?.accountStatus ?? null,
        },
      },
    };
  }

  async forgotPassword(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const authClient = this.supabaseService.createAuthClient();

    const { error } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.PASSWORD_RESET_REDIRECT_URL,
    });

    if (error) {
      throw new BadRequestException('Unable to process the password reset');
    }

    return {
      message:
        'If the email is registered, a password reset link has been sent.',
    };
  }

  async resendConfirmation(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const { error } = await this.supabaseService
      .createAuthClient()
      .auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo:
            process.env.EMAIL_CONFIRMATION_REDIRECT_URL || undefined,
        },
      });

    if (error) {
      throw new BadRequestException('Unable to resend the confirmation email');
    }

    return {
      message:
        'If the account is awaiting confirmation, a new email has been sent.',
    };
  }

  async refresh(refreshToken: string) {
    const { data, error } = await this.supabaseService
      .createAuthClient()
      .auth.refreshSession({
        refresh_token: refreshToken,
      });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('The refresh token is invalid');
    }

    const role = this.rolesService.identifyRole({
      sub: data.user.id,
      email: data.user.email,
      app_metadata: data.user.app_metadata,
    }).value;
    const holder = await this.holderAccountService.findByAuthUserId(
      data.user.id,
    );

    if (role === UserRole.STUDENT && !holder) {
      throw new UnauthorizedException('Holder account was not found');
    }

    if (
      holder?.accountStatus === AccountStatus.REJECTED ||
      holder?.accountStatus === AccountStatus.SUSPENDED
    ) {
      throw new UnauthorizedException(
        `This account is ${holder.accountStatus}`,
      );
    }

    return {
      message: 'Session refreshed',
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        user: {
          authUserId: data.user.id,
          holderAccountId: holder?.holderAccountId ?? null,
          email: data.user.email ?? '',
          role,
          accountStatus: holder?.accountStatus ?? null,
        },
      },
    };
  }

  async logout(
    accessToken: string,
    authUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const { error } = await this.supabaseService.client.auth.admin.signOut(
      accessToken,
      'local',
    );

    if (error) {
      throw new BadRequestException('Unable to sign out');
    }

    await this.loginHistoryService.recordLogout({
      authUserId,
      ipAddress,
      userAgent,
    });

    return { message: 'Logout successful' };
  }

  async updatePassword(authUserId: string, password: string) {
    const { error } =
      await this.supabaseService.client.auth.admin.updateUserById(authUserId, {
        password,
      });

    if (error) {
      throw new BadRequestException('Unable to update the password');
    }

    return { message: 'Password updated successfully' };
  }
}
