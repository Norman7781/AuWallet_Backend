// src/auth-issuer-account/auth-issuer-account.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Database } from '../supabase/database.types';
import { SupabaseService } from '../supabase/supabase.service';

type IssuerAccountRow = Database['wallet']['Tables']['issuer_account']['Row'];

@Injectable()
export class AuthIssuerAccountService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async validateLogin(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const { data: admin, error } = await this.supabase
      .schema('wallet')
      .from('issuer_account')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .single<IssuerAccountRow>();

    if (error || !admin) {
      throw new UnauthorizedException('Incorrect email or password.');
    }

    const passwordMatches = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Incorrect email or password.');
    }

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      issuerProviderId: admin.issuer_provider_id,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    };
  }
}
