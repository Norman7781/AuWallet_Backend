import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationsDirectory = join(
  process.cwd(),
  'src',
  'supabase',
  'migrations',
);
const member1MigrationPath = join(
  migrationsDirectory,
  '202607280001_complete_member1_auth.sql',
);
const member2MigrationPath = join(
  migrationsDirectory,
  '202608052024_member2_onboarding_integration.sql',
);
const member1ApprovedHash =
  '6ba18010d484e0f35521509a1a2e7b1a097a424435a341ed371162060ab7ea51';

describe('Member 2 onboarding integration migration safety', () => {
  const sql = readFileSync(member2MigrationPath, 'utf8').toLowerCase();
  const compactSql = sql.replace(/\s+/g, ' ');
  const replacementStateSql = compactSql.slice(
    compactSql.indexOf(
      'add constraint wallet_onboarding_request_state_check check (',
    ),
    compactSql.indexOf(
      'drop constraint wallet_onboarding_request_matched_enrollment_id_key;',
    ),
  );

  it('leaves Member 1 migration byte-for-byte unchanged', () => {
    const hash = createHash('sha256')
      .update(readFileSync(member1MigrationPath))
      .digest('hex');

    expect(hash).toBe(member1ApprovedHash);
  });

  it('is one explicit transaction with a transaction-level advisory lock', () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*\nbegin;/);
    expect(sql.trimEnd()).toMatch(/commit;$/);
    expect(sql.match(/\bbegin;/g)).toHaveLength(1);
    expect(sql.match(/\bcommit;/g)).toHaveLength(1);
    expect(sql).toContain('pg_advisory_xact_lock');
  });

  it('defines only the backend approval RPC with invoker security and an empty search path', () => {
    expect(sql.match(/create function/g)).toHaveLength(1);
    expect(sql).toContain('create function wallet.approve_onboarding_request(');
    expect(sql).toContain('p_onboarding_request_id bigint');
    expect(sql).toContain('p_reviewed_by uuid');
    expect(sql).toContain('security invoker');
    expect(sql).toContain("set search_path = ''");
    expect(sql).not.toContain('security definer');
  });

  it('locks request then holder and independently revalidates one exact eligible enrollment', () => {
    const requestLock = sql.indexOf(
      'from wallet.wallet_onboarding_request as request',
    );
    const holderLock = sql.indexOf('from wallet.holder_account as holder');
    const requestUpdate = sql.indexOf(
      'update wallet.wallet_onboarding_request as request',
    );
    const holderUpdate = sql.indexOf('update wallet.holder_account as holder');

    expect(requestLock).toBeGreaterThan(0);
    expect(holderLock).toBeGreaterThan(requestLock);
    expect(requestUpdate).toBeGreaterThan(holderLock);
    expect(holderUpdate).toBeGreaterThan(requestUpdate);
    expect(sql.match(/for update;/g)).toHaveLength(2);
    expect(sql).toContain('student.admission_no = v_admission_no');
    expect(sql).toContain('student.date_of_birth = v_date_of_birth');
    expect(sql).toContain(
      'student.passport_number_hmac = v_passport_number_hmac',
    );
    expect(sql).toContain(
      "enrollment.academic_status in ('studying', 'graduated', 'alumni')",
    );
    expect(sql).toContain('v_eligible_enrollment_count <> 1');
    expect(sql).toContain(
      'v_sole_eligible_enrollment_id is distinct from v_candidate_enrollment_id',
    );
  });

  it('keeps activation and review completion inside the approval transaction', () => {
    expect(sql).toContain("set verification_status = 'matched'");
    expect(sql).toContain('reviewed_by = p_reviewed_by');
    expect(sql).toContain('reviewed_at = v_now');
    expect(sql).toContain("set account_status = 'active'");
    expect(sql).toContain(
      'confirmed_at = coalesce(holder.confirmed_at, v_now)',
    );
    expect(sql).toContain("holder.account_status = 'pending'");
  });

  it('replaces the incompatible original onboarding state constraint', () => {
    expect(sql).toContain('drop constraint wallet_onboarding_request_check;');
    expect(sql).toContain(
      'add constraint wallet_onboarding_request_state_check check (',
    );
    expect(sql).toContain("verification_status = 'submitted'");
    expect(sql).toContain("verification_status = 'under_review'");
    expect(sql).toContain("verification_status = 'matched'");
    expect(sql).toContain("verification_status = 'rejected'");
    expect(sql).toContain(
      '(reviewed_by is null and reviewed_at is null)\n        or (reviewed_by is not null and reviewed_at is not null)',
    );
    expect(sql).toContain(
      'the replacement onboarding state constraint differs',
    );
    expect(sql).toContain('pg_temp.expected_wallet_onboarding_state');
    expect(sql.match(/pg_get_expr\(constraint_record\.conbin/g)).toHaveLength(
      2,
    );
  });

  it('encodes every required onboarding state invariant without clearing rejected candidates', () => {
    expect(compactSql).toContain(
      "verification_status = 'submitted' and matched_enrollment_id is null and rejection_reason is null and reviewed_by is null and reviewed_at is null",
    );
    expect(compactSql).toContain(
      "verification_status = 'under_review' and rejection_reason is null and reviewed_by is null and reviewed_at is null",
    );
    expect(compactSql).toContain(
      "verification_status = 'matched' and matched_enrollment_id is not null and rejection_reason is null and reviewed_by is not null and reviewed_at is not null",
    );
    expect(compactSql).toContain(
      "verification_status = 'rejected' and rejection_reason is not null and ( (reviewed_by is null and reviewed_at is null) or (reviewed_by is not null and reviewed_at is not null) )",
    );
    expect(replacementStateSql).not.toContain(
      "verification_status = 'under_review' and matched_enrollment_id is null",
    );
    expect(replacementStateSql).not.toContain(
      "verification_status = 'rejected' and matched_enrollment_id is null",
    );
  });

  it('replaces global candidate uniqueness with exact active-candidate ownership', () => {
    expect(sql).toContain(
      'drop constraint wallet_onboarding_request_matched_enrollment_id_key;',
    );
    expect(sql).toContain(
      "create unique index one_active_candidate_per_enrollment_idx\n  on wallet.wallet_onboarding_request (matched_enrollment_id)\n  where matched_enrollment_id is not null\n    and verification_status in ('under_review', 'matched');",
    );
    expect(sql).toContain('the global candidate uniqueness constraint remains');
    expect(sql).toContain(
      'the active candidate index columns or uniqueness differ',
    );
    expect(sql).toContain('the active candidate index predicate differs');
    expect(sql).toContain(
      'pg_temp.expected_active_candidate_per_enrollment_idx',
    );
  });

  it('preflights the exact legacy constraint identities before replacing them', () => {
    expect(sql).toContain("conname = 'wallet_onboarding_request_check'");
    expect(sql).toContain(
      "conname = 'wallet_onboarding_request_matched_enrollment_id_key'",
    );
    expect(sql).toContain("contype = 'c'");
    expect(sql).toContain("contype = 'u'");
    expect(sql).toContain(
      "pg_get_constraintdef(oid) = 'unique (matched_enrollment_id)'",
    );
  });

  it('rejects a same-named legacy state constraint with a different parsed definition', () => {
    const preflight = sql.slice(
      sql.indexOf('do $preflight$'),
      sql.indexOf('$preflight$;') + '$preflight$;'.length,
    );

    expect(sql).toContain('pg_temp.expected_legacy_wallet_onboarding_state');
    expect(sql).toContain('expected_legacy_wallet_onboarding_state_check');
    expect(preflight.match(/pg_get_expr\(/g)).toHaveLength(2);
    expect(preflight).toContain(
      'v_actual_legacy_state_expression is distinct from\n      v_expected_legacy_state_expression',
    );
    expect(preflight).toContain('the original onboarding state check differs');
    expect(preflight).not.toContain("pg_get_constraintdef(oid) = 'check (");
  });

  it('keeps browser roles off application tables and the approval RPC', () => {
    expect(sql).toContain(
      'revoke all on table wallet.holder_account from anon, authenticated;',
    );
    expect(sql).toContain(
      'wallet.wallet_onboarding_request,\n  wallet.uploaded_identity_document\nfrom anon, authenticated;',
    );
    expect(sql).toContain(
      ') from public, anon, authenticated;\n\ngrant execute on function',
    );
    expect(sql).toContain(') to service_role;');
    expect(sql).not.toMatch(/grant\s+[^;]+\s+to\s+(anon|authenticated)/);
  });

  it('limits service-role academic reads to the four review and matching tables', () => {
    expect(sql).toContain(
      'grant select on table\n  academic.program,\n  academic.student,\n  academic.student_program_enrollment,\n  academic.graduation_record\nto service_role;',
    );
    expect(sql).toContain(
      'service_role academic read scope is not exactly four tables',
    );
    for (const unusedTable of [
      'academic.academic_term',
      'academic.course',
      'academic.course_result',
      'academic.transcript',
    ]) {
      expect(sql).toContain(unusedTable);
    }
  });

  it('retains the active-workflow uniqueness guard and postflight assertions', () => {
    expect(sql).toContain(
      'create unique index one_active_onboarding_request_per_holder_idx',
    );
    expect(sql).toContain(
      "where verification_status in ('submitted', 'under_review', 'matched')",
    );
    expect(sql).toContain('wallet.one_active_candidate_per_enrollment_idx');
    expect(sql).toContain('do $preflight$');
    expect(sql).toContain('do $postflight$');
  });
});
