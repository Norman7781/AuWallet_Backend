import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  __dirname,
  '20260830085648_replace_demo_issuer_providers.sql',
);
const sql = readFileSync(migrationPath, 'utf8');

describe('replace demo issuer providers migration', () => {
  it('replaces only the two unused demo entries with explicit mock providers', () => {
    expect(sql).toContain("issuer_code = 'demo-issuer-alpha'");
    expect(sql).toContain("issuer_code = 'demo-issuer-beta'");
    expect(sql).toContain("issuer_code = 'thaid'");
    expect(sql).toContain("issuer_code = 'dlt-qr-licence'");
    expect(sql).toContain("display_name = 'ThaID (Thai Digital Identity)'");
    expect(sql).toContain("display_name = 'DLT QR Licence'");
  });

  it('keeps both future providers visibly unavailable and non-functional', () => {
    // Each value appears once in its update and once in the postflight check.
    expect(sql.match(/availability = 'coming_soon'/g)).toHaveLength(4);
    expect(sql.match(/connection_verification_enabled = false/g)).toHaveLength(4);
    expect(sql.match(/is_mock = true/g)).toHaveLength(4);
    expect(sql).toContain('It is not connected to ThaID, DOPA, or NDID.');
    expect(sql).toContain('It is not connected to DLT.');
  });

  it('fails safely if either demo provider has already been used', () => {
    expect(sql).toContain('v_demo_provider_count <> 2');
    expect(sql).toContain('v_existing_connection_count <> 0');
    expect(sql).toContain('Issuer-provider migration preflight failed');
    expect(sql).toContain('Issuer-provider migration postflight failed');
  });
});
