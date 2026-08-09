import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Database } from '../../supabase/database.types';
import { SupabaseService } from '../../supabase/supabase.service';
import type { IssuerProviderRecord } from './issuer-connection.interface';

type IssuerProviderRow = Database['wallet']['Tables']['issuer_provider']['Row'];

const PROVIDER_COLUMNS =
  'issuer_provider_id, issuer_code, display_name, description, availability, connection_verification_enabled, is_mock, created_at, updated_at';

function toRecord(row: IssuerProviderRow): IssuerProviderRecord {
  return {
    issuerProviderId: row.issuer_provider_id,
    issuerCode: row.issuer_code,
    displayName: row.display_name,
    description: row.description,
    availability: row.availability,
    connectionVerificationEnabled: row.connection_verification_enabled,
    isMock: row.is_mock,
  };
}

@Injectable()
export class IssuerProviderRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<IssuerProviderRecord[]> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('issuer_provider')
      .select(PROVIDER_COLUMNS)
      .order('issuer_provider_id', { ascending: true });

    if (error) {
      throw new InternalServerErrorException('Unable to load issuer providers');
    }

    return (data as IssuerProviderRow[]).map(toRecord);
  }

  async findByCode(issuerCode: string): Promise<IssuerProviderRecord | null> {
    const { data, error } = await this.supabase
      .schema('wallet')
      .from('issuer_provider')
      .select(PROVIDER_COLUMNS)
      .eq('issuer_code', issuerCode)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Unable to load issuer provider');
    }

    return data ? toRecord(data) : null;
  }
}
