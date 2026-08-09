import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  __dirname,
  '20260809080520_expand_vmes_undergraduate_catalogue.sql',
);
const sql = readFileSync(migrationPath, 'utf8');

const expectedCodes = [
  'SYN-VMES-AIT',
  'SYN-VMES-AME',
  'SYN-VMES-CE',
  'SYN-VMES-CPL',
  'SYN-VMES-CS',
  'SYN-VMES-EE',
  'SYN-VMES-MCE-AI',
  'SYN-VMES-NEA',
];

describe('VMES undergraduate catalogue migration', () => {
  it('is one guarded advisory-lock transaction', () => {
    expect(sql.match(/\bbegin;/gi) ?? []).toHaveLength(1);
    expect(sql.match(/\bcommit;/gi) ?? []).toHaveLength(1);
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('do $preflight$');
    expect(sql).toContain('do $postflight$');
  });

  it('defines exactly the eight approved natural keys and preserves CS', () => {
    for (const code of expectedCodes) {
      expect(sql).toContain(`'${code}'`);
    }

    expect(sql).toContain("'SYN-VMES-CS'");
    expect(sql).toMatch(/'SYN-VMES-CS'[\s\S]*132/);
    expect(sql).toContain("where expected.program_code <> 'SYN-VMES-CS'");
  });

  it('uses the supported credit totals without creating curricula', () => {
    expect(sql).toMatch(/'SYN-VMES-AIT'[\s\S]*126/);
    expect(sql).toMatch(/'SYN-VMES-AME'[\s\S]*141/);
    expect(sql).toMatch(/'SYN-VMES-CE'[\s\S]*140/);
    expect(sql).toMatch(/'SYN-VMES-CPL'[\s\S]*141/);
    expect(sql).toMatch(/'SYN-VMES-EE'[\s\S]*140/);
    expect(sql).toMatch(/'SYN-VMES-MCE-AI'[\s\S]*136/);
    expect(sql).toMatch(/'SYN-VMES-NEA'[\s\S]*126/);
    expect(sql).not.toMatch(/insert into academic\.(course|course_result)/i);
  });

  it('inserts only program metadata and supplies no generated IDs', () => {
    expect(sql.match(/insert into academic\.program/gi) ?? []).toHaveLength(1);
    expect(sql).not.toMatch(/program_id\s*[,)]/i);
    expect(sql).not.toMatch(/\b(update|delete|truncate)\s+academic\./i);
    expect(sql).not.toMatch(
      /\b(insert|update|delete|truncate)\s+(wallet|auth)\./i,
    );
  });

  it('rejects partial/conflicting catalogues and accepts only one or eight rows', () => {
    expect(sql).toContain('v_program_count = 1');
    expect(sql).toContain('v_program_count = 8');
    expect(sql).toContain('catalogue is partial or conflicting');
    expect(sql).toContain('(select count(*) from academic.program) <> 8');
  });

  it('preserves all CS fixture ownership and non-program counts', () => {
    expect(sql).toContain('vmes_catalogue_preflight_counts');
    expect(sql).toContain("program.program_code = 'SYN-VMES-CS'");
    expect(sql).toContain("program.program_code <> 'SYN-VMES-CS'");
    expect(sql).toContain('academic fixture rows changed');
    expect(sql).toContain('CS fixture ownership changed');
  });
});
