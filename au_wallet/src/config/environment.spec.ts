import {
  DEFAULT_ISSUER_UI_ORIGIN,
  DEFAULT_WALLET_UI_ORIGIN,
  PASSPORT_HMAC_SECRET_DOCUMENTATION_PLACEHOLDER,
  SUPABASE_PROJECT_REF,
  validateEnvironment,
} from './environment';

describe('validateEnvironment', () => {
  const baseConfig: Record<string, unknown> = {
    NODE_ENV: 'test',
    PORT: '3000',
    SUPABASE_PROJECT_REF,
    SUPABASE_URL: `https://${SUPABASE_PROJECT_REF}.supabase.co`,
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_placeholder',
    SUPABASE_SECRET_KEY: 'sb_secret_test_placeholder',
    PASSPORT_HMAC_SECRET: 'synthetic-test-secret-with-32-plus-bytes',
  };

  it('uses safe local frontend origins outside production', () => {
    const result = validateEnvironment({ ...baseConfig });

    expect(result.ISSUER_UI_ORIGIN).toBe(DEFAULT_ISSUER_UI_ORIGIN);
    expect(result.WALLET_UI_ORIGIN).toBe(DEFAULT_WALLET_UI_ORIGIN);
  });

  it('normalizes explicitly configured origins', () => {
    const result = validateEnvironment({
      ...baseConfig,
      ISSUER_UI_ORIGIN: 'https://issuer.example.test/',
      WALLET_UI_ORIGIN: 'http://wallet.example.test:3002',
    });

    expect(result.ISSUER_UI_ORIGIN).toBe('https://issuer.example.test');
    expect(result.WALLET_UI_ORIGIN).toBe('http://wallet.example.test:3002');
  });

  it.each([
    ['https://issuer.example.test/path'],
    ['https://issuer.example.test?source=test'],
    ['https://user:password@issuer.example.test'],
    ['ftp://issuer.example.test'],
    ['not-a-url'],
  ])('rejects invalid browser origin %s', (origin) => {
    expect(() =>
      validateEnvironment({
        ...baseConfig,
        ISSUER_UI_ORIGIN: origin,
      }),
    ).toThrow(/ISSUER_UI_ORIGIN/);
  });

  it('requires both frontend origins in production', () => {
    expect(() =>
      validateEnvironment({
        ...baseConfig,
        NODE_ENV: 'production',
      }),
    ).toThrow('ISSUER_UI_ORIGIN is required');

    expect(() =>
      validateEnvironment({
        ...baseConfig,
        NODE_ENV: 'production',
        ISSUER_UI_ORIGIN: 'https://issuer.example.test',
      }),
    ).toThrow('WALLET_UI_ORIGIN is required');
  });

  it('rejects a port outside the TCP range', () => {
    expect(() =>
      validateEnvironment({
        ...baseConfig,
        PORT: '65536',
      }),
    ).toThrow('PORT must be an integer between 1 and 65535');
  });

  it('requires a sufficiently long passport HMAC secret', () => {
    expect(() =>
      validateEnvironment({
        ...baseConfig,
        PASSPORT_HMAC_SECRET: 'too-short',
      }),
    ).toThrow('PASSPORT_HMAC_SECRET must be at least 32 bytes');
  });

  it('rejects the documentation placeholder even though it is long enough', () => {
    expect(() =>
      validateEnvironment({
        ...baseConfig,
        PASSPORT_HMAC_SECRET: PASSPORT_HMAC_SECRET_DOCUMENTATION_PLACEHOLDER,
      }),
    ).toThrow(
      'PASSPORT_HMAC_SECRET must not use the documentation placeholder',
    );
  });
});
