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
    cNonceExpiresAt: string,
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

    // A transcript may have only one live offer at a time. Re-issuing an
    // offer intentionally replaces an unclaimed one; otherwise an old test
    // or abandoned offer can remain visible in the holder wallet forever.
    const { error: revokePendingError } = await this.supabase
      .from('vc_issuance_log')
      .update({ status: 'revoked' })
      .eq('student_id', studentId)
      .eq('status', 'pending');

    if (revokePendingError) throw revokePendingError;

    const { data, error } = await this.supabase
      .from('vc_issuance_log')
      .insert({
        code,
        student_id: studentId,
        claims,
        status: 'pending',
        c_nonce: cNonce,
        c_nonce_expires_at: cNonceExpiresAt,
        tx_code_hash: txCodeHash,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async attachAccessToken(
    code: string,
    accessToken: string,
    cNonce: string,
    cNonceExpiresAt: string,
  ) {
    const { data, error } = await this.supabase
      .from('vc_issuance_log')
      .update({
        access_token: accessToken,
        c_nonce: cNonce,
        c_nonce_expires_at: cNonceExpiresAt,
        c_nonce_consumed_at: null,
        c_nonce_holder_account_id: null,
      })
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
  async findByStudentId(studentId: string) {
    const { data, error } = await this.supabase
      .from('vc_issuance_log')
      .select(
        'code, student_id, claims, status, created_at, issued_at, accepted_at, credential_id, c_nonce, c_nonce_expires_at, c_nonce_consumed_at, c_nonce_holder_account_id',
      )
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async ensureActiveDirectOfferNonce(
    offer: {
      code: string;
      student_id: string;
      c_nonce: string | null;
      c_nonce_expires_at: string | null;
      c_nonce_consumed_at: string | null;
      c_nonce_holder_account_id: number | null;
    },
    holderAccountId: number,
    nonce: string,
    expiresAt: string,
  ) {
    const expiration = offer.c_nonce_expires_at
      ? Date.parse(offer.c_nonce_expires_at)
      : Number.NaN;
    const hasActiveBoundNonce =
      Boolean(offer.c_nonce) &&
      offer.c_nonce_consumed_at === null &&
      offer.c_nonce_holder_account_id === holderAccountId &&
      Number.isFinite(expiration) &&
      expiration > Date.now();

    if (hasActiveBoundNonce) return offer;

    const { data, error } = await this.supabase
      .from('vc_issuance_log')
      .update({
        c_nonce: nonce,
        c_nonce_expires_at: expiresAt,
        c_nonce_consumed_at: null,
        c_nonce_holder_account_id: holderAccountId,
      })
      .eq('code', offer.code)
      .eq('student_id', offer.student_id)
      .eq('status', 'pending')
      .select(
        'code, student_id, claims, status, created_at, issued_at, accepted_at, credential_id, c_nonce, c_nonce_expires_at, c_nonce_consumed_at, c_nonce_holder_account_id',
      )
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Atomically transitions a pending offer straight to issued, storing the
   * signed credential's ID. Only succeeds if the offer is still 'pending'
   * for this student — prevents double-issuance and races.
   */
  async markIssuedFromAccept(
    code: string,
    studentId: string,
    holderAccountId: number,
    nonce: string,
    credentialId: string,
  ) {
    const acceptedAt = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('vc_issuance_log')
      .update({
        status: 'issued',
        credential_id: credentialId,
        issued_at: acceptedAt,
        accepted_at: acceptedAt,
        c_nonce_consumed_at: acceptedAt,
      })
      .eq('code', code)
      .eq('student_id', studentId)
      .eq('status', 'pending')
      .eq('c_nonce', nonce)
      .eq('c_nonce_holder_account_id', holderAccountId)
      .is('c_nonce_consumed_at', null)
      .gt('c_nonce_expires_at', new Date().toISOString())
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
