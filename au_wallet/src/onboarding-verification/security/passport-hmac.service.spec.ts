import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportHmacService } from './passport-hmac.service';

const SYNTHETIC_TEST_SECRET = 'synthetic-test-secret-not-for-production';

function createService(secret: unknown) {
  return new PassportHmacService({
    get: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService);
}

describe('PassportHmacService', () => {
  it('normalizes NFKC, whitespace, hyphens, and letter case consistently', () => {
    const service = createService(SYNTHETIC_TEST_SECRET);

    const formatted = service.computePassportHmac('  Ｄｅｍｏ - １２３  ');
    const canonical = service.computePassportHmac('DEMO123');

    expect(formatted).toBe(canonical);
  });

  it('returns a lowercase hexadecimal HMAC without exposing its value', () => {
    const service = createService(SYNTHETIC_TEST_SECRET);
    const result = service.computePassportHmac('SYNTHETIC-ID-A');

    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces distinct outputs for distinct normalized identifiers', () => {
    const service = createService(SYNTHETIC_TEST_SECRET);

    expect(service.computePassportHmac('SYNTHETIC-ID-A')).not.toBe(
      service.computePassportHmac('SYNTHETIC-ID-B'),
    );
  });

  it('rejects an identifier that is empty after normalization', () => {
    const service = createService(SYNTHETIC_TEST_SECRET);

    expect(() => service.computePassportHmac('  - -  ')).toThrow(
      BadRequestException,
    );
  });

  it.each([undefined, null, '', '   '])(
    'fails closed when the backend secret is unavailable',
    (secret) => {
      expect(() => createService(secret)).toThrow(
        'PASSPORT_HMAC_SECRET is required',
      );
    },
  );
});
