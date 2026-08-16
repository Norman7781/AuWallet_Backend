import { Injectable } from '@nestjs/common';
import { AcademicTranscriptClaims } from './Academic_tran_type';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class IssuanceRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client as any;
  }

  async savePendingOffer(
    claims: AcademicTranscriptClaims,
    code: string,
    cNonce: string,
    txCodeHash: string,
  ) {
    const studentId = claims.student?.identifier?.value;
    if (!studentId) {
      throw new Error('claims.student.identifier.value is required');
    }

    // Duplicate-issuance guard: block a second offer for the same
    // student_id if one has already been issued.
    const { data: existing } = await this.supabase
      .from('vc_issuance_log')
      .select('status')
      .eq('student_id', studentId)
      .eq('status', 'issued')
      .maybeSingle();

    if (existing) {
      throw new Error(
        `Academic transcript already issued for student ${studentId}`,
      );
    }

    const { data, error } = await this.supabase
      .from('vc_issuance_log')
      .insert({
        code,
        student_id: studentId,
        claims,
        status: 'pending',
        c_nonce: cNonce,
        tx_code_hash: txCodeHash,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async attachAccessToken(code: string, accessToken: string, cNonce: string) {
    const { data, error } = await this.supabase
      .from('vc_issuance_log')
      .update({ access_token: accessToken, c_nonce: cNonce })
      .eq('code', code)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findPendingByCode(code: string) {
    const { data, error } = await this.supabase
      .from('vc_issuance_log')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findByAccessToken(token: string) {
    const { data, error } = await this.supabase
      .from('vc_issuance_log')
      .select('*')
      .eq('access_token', token)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async markIssued(code: string) {
    const { data, error } = await this.supabase
      .from('vc_issuance_log')
      .update({ status: 'issued', issued_at: new Date().toISOString() })
      .eq('code', code)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async markRevoked(code: string) {
    const { data, error } = await this.supabase
      .from('vc_issuance_log')
      .update({ status: 'revoked' })
      .eq('code', code)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Audit: which students received which credentials */
  async listIssued() {
    const { data, error } = await this.supabase
      .from('vc_issuance_log')
      .select('*')
      .eq('status', 'issued');

    if (error) throw error;
    return data;
  }
}
