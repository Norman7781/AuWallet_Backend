import { Injectable, UnauthorizedException } from '@nestjs/common';
import { importJWK, jwtVerify, decodeProtectedHeader } from 'jose';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PROOF_AGE_SECONDS = 300;
const MAX_FUTURE_IAT_SECONDS = 30;

@Injectable()
export class ProofOfPossessionService {
  async verifyAndExtractKey(
    proofJwt: string,
    expectedAudience: string,
    expectedNonce: string,
    expectedIssuer?: string,
  ): Promise<Record<string, any>> {
    const header = decodeProtectedHeader(proofJwt);

    if (header.typ !== 'openid4vci-proof+jwt') {
      throw new UnauthorizedException('invalid proof type');
    }
    if (header.alg !== 'ES256') {
      throw new UnauthorizedException('invalid proof algorithm');
    }
    if (!this.isPublicP256Jwk(header.jwk)) {
      throw new UnauthorizedException('proof JWT missing holder public key');
    }

    const holderKey = await importJWK(header.jwk, 'ES256');
    const { payload } = await jwtVerify(proofJwt, holderKey, {
      audience: expectedAudience,
      ...(expectedIssuer ? { issuer: expectedIssuer } : {}),
    });

    if (payload.nonce !== expectedNonce) {
      throw new UnauthorizedException(
        'nonce mismatch — stale or replayed proof',
      );
    }

    if (expectedIssuer) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (
        typeof payload.iat !== 'number' ||
        payload.iat < nowSeconds - MAX_PROOF_AGE_SECONDS ||
        payload.iat > nowSeconds + MAX_FUTURE_IAT_SECONDS
      ) {
        throw new UnauthorizedException('invalid or stale proof iat');
      }

      if (typeof payload.jti !== 'string' || !UUID_PATTERN.test(payload.jti)) {
        throw new UnauthorizedException('proof JWT requires a UUID jti');
      }
    }

    return header.jwk;
  }

  private isPublicP256Jwk(value: unknown): value is Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const jwk = value as Record<string, unknown>;
    return (
      jwk.kty === 'EC' &&
      jwk.crv === 'P-256' &&
      typeof jwk.x === 'string' &&
      typeof jwk.y === 'string' &&
      jwk.d === undefined
    );
  }
}
