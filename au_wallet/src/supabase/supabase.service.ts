import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnvironmentVariables } from '../config/environment';
import { Database } from './database.types';

export type ApplicationSchema = 'academic' | 'wallet';

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient<Database>;
  private readonly supabaseUrl: string;
  private readonly publishableKey: string;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.supabaseUrl = configService.get('SUPABASE_URL', { infer: true });
    this.publishableKey = configService.get('SUPABASE_PUBLISHABLE_KEY', {
      infer: true,
    });
    this.client = createClient<Database>(
      this.supabaseUrl,
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

  schema<SchemaName extends ApplicationSchema>(schema: SchemaName) {
    return this.client.schema(schema);
  }

  createAuthClient(): SupabaseClient<Database> {
    return createClient<Database>(this.supabaseUrl, this.publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: {
          'X-Client-Info': 'au-wallet-auth-request',
        },
      },
    });
  }
}
