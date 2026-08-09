import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  __dirname,
  '20260809131004_remove_synthetic_free_electives.sql',
);
const sql = readFileSync(migrationPath, 'utf8');

const mapping = [
  ['SYN-FE1001', 'ITX2004'],
  ['SYN-FE1002', 'ITX3003'],
  ['SYN-FE1003', 'ITX4502'],
  ['SYN-FE1004', 'ITX4518'],
];

describe('synthetic free-elective correction migration', () => {
  it('uses one guarded transaction with bounded locks', () => {
    expect(sql.match(/\bbegin;/gi) ?? []).toHaveLength(1);
    expect(sql.match(/\bcommit;/gi) ?? []).toHaveLength(1);
    expect(sql).toContain("set local lock_timeout = '5s'");
    expect(sql).toContain("set local statement_timeout = '30s'");
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('do $preflight$');
    expect(sql).toContain('do $postflight$');
  });

  it('contains only the exact approved deterministic mapping', () => {
    for (const [oldCode, newCode] of mapping) {
      expect(sql).toContain(`'${oldCode}'`);
      expect(sql).toContain(`'${newCode}'`);
    }

    expect(sql.match(/'SYN-FE\d{4}'/g) ?? []).toHaveLength(4);
  });

  it('accepts exact State A and exact State B only', () => {
    expect(sql).toContain("state_name in ('A', 'B')");
    expect(sql).toContain("values (case when v_state_a then 'A' else 'B' end)");
    expect(sql).toContain('(select count(*) from academic.course) = 74');
    expect(sql).toContain('(select count(*) from academic.course) = 70');
    expect(sql).toContain('v_state_a := coalesce(v_state_a, false)');
    expect(sql).toContain('v_state_b := coalesce(v_state_b, false)');
    expect(sql).toContain('partial or unexpected fixture state');
    expect(sql).toContain('ambiguous fixture state');
  });

  it('rejects conflicts and unexpected result cardinalities', () => {
    expect(sql).toContain('conflict.enrollment_id = old_result.enrollment_id');
    expect(sql).toContain('conflict.course_id = replacement_course.course_id');
    expect(sql).toContain('having count(*) <> 10');
    expect(sql).toContain('count(distinct course.course_code) = 4');
    expect(sql).toContain('expected 40 remapped results');
    expect(sql).toContain('expected four deleted courses');
  });

  it('changes only result course_id and deletes only obsolete courses', () => {
    expect(sql.match(/update academic\.course_result/gi) ?? []).toHaveLength(1);
    expect(sql).toMatch(
      /update academic\.course_result as result\s+set course_id = snapshot\.expected_course_id/i,
    );
    expect(sql.match(/delete from academic\.course/gi) ?? []).toHaveLength(1);
    expect(sql).not.toMatch(/insert into academic\./i);
    expect(sql).not.toMatch(/update academic\.(?!course_result)/i);
    expect(sql).not.toMatch(/delete from academic\.(?!course\b)/i);
    expect(sql).not.toMatch(/\b(alter|truncate)\s+academic\./i);
  });

  it('snapshots and compares every non-course result value', () => {
    expect(sql).toContain("to_jsonb(result) - 'course_id'");
    expect(sql).toContain('free_elective_result_snapshot');
    expect(sql).toContain(
      'result.course_result_id = snapshot.course_result_id',
    );
    expect(sql).toContain(
      "to_jsonb(result) - 'course_id' is distinct from snapshot.protected_values",
    );
    expect(sql).toContain('result_non_course_fingerprint');
    expect(sql).toContain('calculated_gpa_fingerprint');
  });

  it('requires the exact corrected catalogue and reconciliation postflight', () => {
    for (const assertion of [
      '(select count(*) from academic.course) <> 70',
      '(select count(*) from academic.course where default_credits = 3) <> 62',
      '(select count(*) from academic.course where default_credits = 2) <> 8',
      '(select sum(default_credits) from academic.course) <> 202',
      '(select count(*) from academic.course_result) <> 649',
      'having count(*) > 1',
      'graduation.total_credits_earned = 132',
      'result_totals.earned_credits = 132',
    ]) {
      expect(sql).toContain(assertion);
    }
  });

  it('contains no application-security or identity-system statements', () => {
    expect(sql).not.toMatch(/\b(?:wallet|auth)\./i);
    expect(sql).not.toMatch(/\b(?:grant|revoke|policy|row level security)\b/i);
    expect(sql).not.toMatch(
      /set\s+(?:student_id|enrollment_id|course_result_id)\s*=/i,
    );
    expect(sql).not.toMatch(/\bnextval\s*\(/i);
  });
});
