import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(
    __dirname,
    '../../../scripts/generate-academic-passport-rotation-sql.mjs',
  ),
  'utf8',
);

describe('synthetic academic passport rotation generator', () => {
  it('requires 20 ignored eight-character alphanumeric inputs', () => {
    expect(source).toContain('SEED_PASSPORT_${admissionNo}');
    expect(source).toContain('/^[A-Z0-9]{8}$/');
    expect(source).toContain('expectedRows.length !== 20');
  });

  it('generates one guarded, idempotent transaction', () => {
    expect(source).toContain('BEGIN ISOLATION LEVEL REPEATABLE READ;');
    expect(source).toContain('pg_advisory_xact_lock');
    expect(source).toContain('LOCK TABLE academic.student');
    expect(source).toContain('NOT IN (0, 20)');
    expect(source).toContain('v_updated_count <> 20');
    expect(source).toContain('COMMIT;');
  });

  it('updates only the passport HMAC and protects every other fixture field', () => {
    expect(source).toContain(
      'SET passport_number_hmac = expected.passport_number_hmac',
    );
    expect(source).toContain("to_jsonb(student) - 'passport_number_hmac'");
    expect(source).toContain('changed a protected student field');
    expect(source).toContain('changed protected academic aggregates');
    expect(source).not.toMatch(/(?:insert into|update|delete from) wallet\./i);
    expect(source).not.toMatch(/(?:insert into|update|delete from) auth\./i);
  });
});
