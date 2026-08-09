import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('issuer academic read API migration', () => {
  const sql = readFileSync(
    join(__dirname, '20260809122011_issuer_academic_read_api.sql'),
    'utf8',
  ).toLowerCase();

  it('grants only the minimum pre-issuance read tables to service_role', () => {
    expect(sql).toMatch(
      /grant select on table\s+academic\.academic_term,\s+academic\.course,\s+academic\.course_result\s+to service_role;/,
    );
    expect(sql).not.toMatch(/grant .*(insert|update|delete).*service_role/);
    expect(sql).not.toMatch(/grant .*academic\.transcript/);
    expect(sql).not.toMatch(/grant .*wallet\./);
  });

  it('keeps browser roles outside every academic application table', () => {
    expect(sql).toMatch(
      /revoke all on table\s+academic\.academic_term,\s+academic\.course,\s+academic\.course_result\s+from anon, authenticated;/,
    );
    expect(sql).not.toMatch(/grant .*\b(anon|authenticated)\b/);
  });

  it('contains preflight and postflight privilege assertions', () => {
    expect(sql).toContain('do $preflight$');
    expect(sql).toContain('do $postflight$');
    expect(sql).toContain("has_table_privilege('service_role'");
    expect(sql).toContain("array['anon', 'authenticated']");
    expect(sql.trim()).toMatch(/^begin;[\s\S]*commit;$/);
  });

  it('contains no data mutation or schema-object creation', () => {
    expect(sql).not.toMatch(/\b(insert|update|delete)\s+(into|academic\.)/);
    expect(sql).not.toMatch(
      /\b(create|alter|drop)\s+(table|view|function|index)/,
    );
  });
});
