import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnvironmentVariables } from '../config/environment';
import { Database } from './database.types';

export type ApplicationSchema = 'academic' | 'wallet';

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient<Database>;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.client = createClient<Database>(
      configService.get('SUPABASE_URL', { infer: true }),
      configService.get('SUPABASE_SECRET_KEY', { infer: true }),
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
        global: {
          headers: {
            'X-Client-Info': 'au-wallet-issuer-backend',
          },
        },
      },
    );
  }

  schema(schema: ApplicationSchema) {
    return this.client.schema(schema);
  }
}
