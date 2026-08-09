import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Database } from '../../supabase/database.types';
import { SupabaseService } from '../../supabase/supabase.service';
import { AccountStatus } from '../common/enums/account-status.enum';
import { HolderAccount } from './holder-account.interface';

type HolderAccountRow = Database['wallet']['Tables']['holder_account']['Row'];
type EmailColumn = 'personal_email' | 'university_email';

const HOLDER_ACCOUNT_COLUMNS =
  'holder_account_id, auth_user_id, university_email, personal_email, account_status, confirmed_at, created_at, updated_at';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toHolderAccount(row: HolderAccountRow): HolderAccount {
  return {
    holderAccountId: row.holder_account_id,
    authUserId: row.auth_user_id,
    universityEmail: row.university_email,
    personalEmail: row.personal_email,
    accountStatus: row.account_status as AccountStatus,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class HolderAccountService {
  constructor(private readonly supabase: SupabaseService) {}

  async findByEmail(email: string): Promise<HolderAccount | null> {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return null;
    }

    const personalAccount = await this.findByEmailColumn(
      'personal_email',
      normalizedEmail,
    );

    if (personalAccount) {
      return personalAccount;
    }

    return this.findByEmailColumn('university_email', normalizedEmail);
  }

  async createPending(
    authUserId: string,
    personalEmail: string,
  ): Promise<HolderAccount> {
    const normalizedEmail = normalizeEmail(personalEmail);

    if (!normalizedEmail) {
      throw new ConflictException('A personal email is required');
    }

    const { data, error } = await this.supabase
      .schema('wallet')
      .from('holder_account')
      .insert({
        auth_user_id: authUserId,
        personal_email: normalizedEmail,
        account_status: AccountStatus.PENDING,
      })
      .select(HOLDER_ACCOUNT_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'A holder account already exists for this email',
        );
      }

      throw new InternalServerErrorException(
        'Unable to create the holder account',
      );
    }

    return toHolderAccount(data);
  }

  async findByPersonalEmail(email: string): Promise<HolderAccount | null> {
    return this.findByEmailColumn('personal_email', normalizeEmail(email));
  }

  async findByAuthUserId(authUserId: string): Promise<HolderAccount | null> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('holder_account')
      .select(HOLDER_ACCOUNT_COLUMNS)
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        'Unable to load the holder account',
      );
    }

    return data ? toHolderAccount(data) : null;
  }

  async updateUniversityEmail(
    authUserId: string,
    universityEmail: string | null,
  ): Promise<HolderAccount> {
    const holder = await this.requireByAuthUserId(authUserId);

    if (
      holder.accountStatus === AccountStatus.REJECTED ||
      holder.accountStatus === AccountStatus.SUSPENDED
    ) {
      throw new ForbiddenException(
        'This holder account cannot currently be updated',
      );
    }

    const normalizedEmail = universityEmail
      ? normalizeEmail(universityEmail)
      : null;
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('holder_account')
      .update({
        university_email: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', authUserId)
      .select(HOLDER_ACCOUNT_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'This university email is already connected to another account',
        );
      }

      throw new InternalServerErrorException(
        'Unable to update the holder account',
      );
    }

    return toHolderAccount(data);
  }

  async updateStatus(
    holderAccountId: number,
    accountStatus: AccountStatus,
  ): Promise<HolderAccount> {
    if (accountStatus === AccountStatus.ACTIVE) {
      throw new ConflictException(
        'A holder account can only be activated after confirmed login',
      );
    }

    const updates: Database['wallet']['Tables']['holder_account']['Update'] = {
      account_status: accountStatus,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .schema('wallet')
      .from('holder_account')
      .update(updates)
      .eq('holder_account_id', holderAccountId)
      .select(HOLDER_ACCOUNT_COLUMNS)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        'Unable to update the holder account status',
      );
    }

    if (!data) {
      throw new NotFoundException('Holder account was not found');
    }

    return toHolderAccount(data);
  }

  async activateAfterConfirmedLogin(
    authUserId: string,
    confirmedAt: string,
  ): Promise<HolderAccount> {
    const holder = await this.requireByAuthUserId(authUserId);

    if (holder.accountStatus !== AccountStatus.PENDING) {
      return holder;
    }

    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('holder_account')
      .update({
        account_status: AccountStatus.ACTIVE,
        confirmed_at: holder.confirmedAt ?? confirmedAt,
        updated_at: now,
      })
      .eq('auth_user_id', authUserId)
      .eq('account_status', AccountStatus.PENDING)
      .select(HOLDER_ACCOUNT_COLUMNS)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        'Unable to activate the holder account',
      );
    }

    if (data) {
      return toHolderAccount(data);
    }

    // A concurrent confirmed login may have completed the same transition.
    return this.requireByAuthUserId(authUserId);
  }

  private async requireByAuthUserId(
    authUserId: string,
  ): Promise<HolderAccount> {
    const holder = await this.findByAuthUserId(authUserId);

    if (!holder) {
      throw new NotFoundException('Holder account was not found');
    }

    return holder;
  }

  private async findByEmailColumn(
    column: EmailColumn,
    email: string,
  ): Promise<HolderAccount | null> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('holder_account')
      .select(HOLDER_ACCOUNT_COLUMNS)
      .eq(column, email)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        'Unable to load the holder account',
      );
    }

    return data ? toHolderAccount(data) : null;
  }
}
