import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  __dirname,
  '20260809054042_decouple_wallet_account_and_add_issuer_connections.sql',
);
const sql = readFileSync(migrationPath, 'utf8');

function functionBody(name: string): string {
  const start = sql.indexOf(`create function wallet.${name}`);
  const end = sql.indexOf('$function$;', start);

  if (start < 0 || end < 0) {
    throw new Error(`Function ${name} was not found`);
  }

  return sql.slice(start, end);
}

describe('issuer connection follow-up migration', () => {
  it('is one guarded transaction with a transaction-level advisory lock', () => {
    expect(sql.match(/\bbegin;/gi) ?? []).toHaveLength(1);
    expect(sql.match(/\bcommit;/gi) ?? []).toHaveLength(1);
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('do $preflight$');
    expect(sql).toContain('do $postflight$');
  });

  it('creates the provider and connection tables with PostgreSQL identities', () => {
    expect(sql).toMatch(
      /create table wallet\.issuer_provider[\s\S]*generated always as identity/,
    );
    expect(sql).toMatch(
      /create table wallet\.holder_issuer_connection[\s\S]*generated always as identity/,
    );
    expect(sql).toContain('unique (holder_account_id, issuer_provider_id)');
    expect(sql).not.toMatch(/issuer_provider_id\s*\)\s*values/i);
  });

  it('allows only one verified holder claim per provider and enrollment', () => {
    expect(sql).toMatch(
      /create unique index one_verified_connection_per_provider_enrollment_idx\s+on wallet\.holder_issuer_connection\s*\(\s*issuer_provider_id,\s*verified_enrollment_id\s*\)\s*where connection_status = 'verified'\s+and verified_enrollment_id is not null;/,
    );
    expect(sql).toContain('expected_verified_connection_claim_idx');
    expect(sql).toContain(
      "array['issuer_provider_id', 'verified_enrollment_id']::text[]",
    );
    expect(sql).toContain('verified enrollment claim index differs');
    expect(sql).not.toContain(
      'create index holder_issuer_connection_verified_enrollment_idx',
    );
  });

  it('seeds exactly the three approved mock provider natural keys', () => {
    expect(
      (sql.match(/'assumption-university'/g) ?? []).length,
    ).toBeGreaterThan(2);
    expect(sql).toContain("'demo-issuer-alpha'");
    expect(sql).toContain("'demo-issuer-beta'");
    expect(sql).toContain("'coming_soon'");
  });

  it('preserves request identities and scopes active attempts to a connection', () => {
    expect(sql).toContain('add column holder_issuer_connection_id bigint');
    expect(sql).toContain('one_active_verification_attempt_per_connection_idx');
    expect(sql).toMatch(
      /one_active_verification_attempt_per_connection_idx[\s\S]*holder_issuer_connection_id[\s\S]*submitted[\s\S]*under_review/,
    );
    expect(sql).toContain(
      'drop index wallet.one_active_onboarding_request_per_holder_idx',
    );
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\btruncate\s+(?:table\s+)?(?:academic|wallet)\./i);
  });

  it('limits the backfill update to unlinked requests resolved through AU', () => {
    expect(sql).toMatch(
      /update wallet\.wallet_onboarding_request[\s\S]*where request\.holder_issuer_connection_id is null[\s\S]*connection\.holder_account_id = request\.holder_account_id/,
    );
    expect(sql).toContain(
      'Issuer-connection migration preflight failed: existing request history is ambiguous',
    );
  });

  it('automatically revalidates AU identity and updates only the request and connection', () => {
    const submission = functionBody('submit_issuer_connection_verification');

    expect(submission).toContain("'assumption-university'");
    expect(submission).toContain(
      'student.admission_no = btrim(p_admission_no)',
    );
    expect(submission).toContain('student.date_of_birth = p_date_of_birth');
    expect(submission).toContain(
      'student.passport_number_hmac = p_passport_number_hmac',
    );
    expect(submission).toContain('v_eligible_enrollment_count = 1');
    expect(submission).toContain(
      'insert into wallet.wallet_onboarding_request',
    );
    expect(submission).toContain('update wallet.holder_issuer_connection');
    expect(submission).not.toContain('update wallet.holder_account');
    expect(submission).not.toMatch(/matched_enrollment_id\s+bigint/);
  });

  it('serializes duplicate claims and turns uniqueness races into a generic rejection', () => {
    const submission = functionBody('submit_issuer_connection_verification');

    expect(submission).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(submission).toContain('au_wallet:issuer_enrollment_claim:%s:%s');
    expect(submission).toContain('claimed.issuer_provider_id = v_provider_id');
    expect(submission).toContain(
      'claimed.verified_enrollment_id = v_sole_eligible_enrollment_id',
    );
    expect(submission.match(/when unique_violation then/g) ?? []).toHaveLength(
      2,
    );
    expect(submission).toContain('v_is_verified := false');
    expect(submission).toContain("'ISSUER_VERIFICATION_NOT_CONFIRMED'");
    expect(submission).not.toMatch(
      /already linked|already claimed|other holder|duplicate claim/i,
    );
  });

  it('retains deprecated review finalizers without coupling holder state', () => {
    const approval = functionBody('approve_onboarding_request');

    expect(approval).toContain("v_provider_code <> 'assumption-university'");
    expect(approval).toContain('student.admission_no = v_admission_no');
    expect(approval).toContain('student.date_of_birth = v_date_of_birth');
    expect(approval).toContain(
      'student.passport_number_hmac = v_passport_number_hmac',
    );
    expect(approval).toContain('v_eligible_enrollment_count <> 1');
    expect(approval).toContain('update wallet.wallet_onboarding_request');
    expect(approval).toContain('update wallet.holder_issuer_connection');
    expect(approval).not.toContain('update wallet.holder_account');
  });

  it('keeps submission and compatibility decisions backend-only security invoker functions', () => {
    expect(sql).toMatch(
      /create function wallet\.submit_issuer_connection_verification[\s\S]*security invoker[\s\S]*set search_path = ''/,
    );
    expect(sql).toMatch(
      /revoke all on function wallet\.submit_issuer_connection_verification[\s\S]*from public, anon, authenticated/,
    );
    expect(sql).toMatch(
      /grant execute on function wallet\.submit_issuer_connection_verification[\s\S]*to service_role/,
    );
    expect(sql).toMatch(
      /create function wallet\.approve_onboarding_request[\s\S]*security invoker[\s\S]*set search_path = ''/,
    );
    expect(sql).toMatch(
      /revoke all on function wallet\.approve_onboarding_request[\s\S]*from public, anon, authenticated/,
    );
    expect(sql).toMatch(
      /grant execute on function wallet\.approve_onboarding_request[\s\S]*to service_role/,
    );
    expect(sql).toContain(
      'create function wallet.reject_issuer_verification_request',
    );
  });

  it('allows automatic matched rows without fake reviewer metadata', () => {
    expect(sql).toContain(
      'drop constraint wallet_onboarding_request_state_check',
    );
    expect(sql).toContain('expected_automatic_onboarding_state_check');
    expect(sql).toMatch(
      /verification_status = 'matched'[\s\S]*reviewed_by is null and reviewed_at is null[\s\S]*reviewed_by is not null and reviewed_at is not null/,
    );
    expect(sql).toContain('onboarding state constraint differs');
  });

  it('finalizes legacy active attempts without deleting or recreating them', () => {
    expect(sql).toContain('with legacy_classification as');
    expect(sql).toContain(
      "verification_status in ('submitted', 'under_review')",
    );
    expect(sql).toContain("'ISSUER_VERIFICATION_NOT_CONFIRMED'");
    expect(sql).toContain('legacy active request was not finalized');
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
  });

  it('enables RLS and denies browser table access while using minimal service grants', () => {
    expect(sql).toContain(
      'alter table wallet.issuer_provider enable row level security',
    );
    expect(sql).toContain(
      'alter table wallet.holder_issuer_connection enable row level security',
    );
    expect(sql).toMatch(
      /revoke all on table wallet\.issuer_provider,[\s\S]*wallet\.holder_issuer_connection[\s\S]*from public, anon, authenticated, service_role/,
    );
    expect(sql).toContain(
      'grant select on table wallet.issuer_provider to service_role',
    );
    expect(sql).toMatch(
      /grant select, insert, update on table wallet\.holder_issuer_connection[\s\S]*to service_role/,
    );
  });

  it('asserts protected counts, holder rows and request identities remain unchanged', () => {
    expect(sql).toContain('issuer_connection_preflight_counts');
    expect(sql).toContain('issuer_connection_holder_snapshot');
    expect(sql).toContain('issuer_connection_request_snapshot');
    expect(sql).toContain(
      'Issuer-connection migration postflight failed: protected row counts changed',
    );
  });
});
