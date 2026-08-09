import { Injectable, UnauthorizedException } from '@nestjs/common';
import { importJWK, jwtVerify, decodeProtectedHeader } from 'jose';

@Injectable()
export class ProofOfPossessionService {
  async verifyAndExtractKey(
    proofJwt: string,
    expectedAudience: string,
    expectedNonce: string,
  ): Promise<Record<string, any>> {
    const header = decodeProtectedHeader(proofJwt);

    if (header.typ !== 'openid4vci-proof+jwt') {
      throw new UnauthorizedException('invalid proof type');
    }
    if (!header.jwk) {
      throw new UnauthorizedException('proof JWT missing holder public key');
    }

    const holderKey = await importJWK(header.jwk as any, 'ES256');
    const { payload } = await jwtVerify(proofJwt, holderKey, {
      audience: expectedAudience,
    });

    if (payload.nonce !== expectedNonce) {
      throw new UnauthorizedException(
        'nonce mismatch — stale or replayed proof',
      );
    }

    return header.jwk as Record<string, any>;
  }
}
