import { Injectable, OnModuleInit } from '@nestjs/common';
import { SDJwtVcInstance } from '@sd-jwt/sd-jwt-vc';
import type { DisclosureFrame } from '@sd-jwt/core';
import { digest, generateSalt } from '@sd-jwt/crypto-nodejs';
import { generateKeyPair, exportJWK, importJWK } from 'jose';
import { KeyObject, sign as cryptoSign } from 'node:crypto';
import { derToJose } from './Vc_Cyto';
import { AcademicTranscriptClaims } from './Academic_tran_type';
import { URL } from 'node:url';
import { promises as dns } from 'node:dns';

// async function isValidDomain(domain: string): Promise<boolean> {
//   try {
//     await dns.lookup(domain);
//     return true;
//   } catch {
//     return false;
//   }
// }

// const ISSUER_HOST = process.env.VC_ISSUER_HOST;
// if (!ISSUER_HOST) {
//   throw new Error('VC_ISSUER_HOST is required');
// }

// try {
//   const valid = await isValidDomain(ISSUER_HOST);
//   if (!valid) {
//     throw new Error(`Domain does not resolve: ${ISSUER_HOST}`);
//   }
// } catch (error) {
//   throw new Error(`Invalid domain: ${ISSUER_HOST}`);
// }

function isValidDomain(domain: string): boolean {
  try {
    const url = new URL(`https://${domain}`);
    const hostname = url.hostname;

    if (!hostname.includes('.')) {
      return false;
    }

    if (
      hostname.includes('..') ||
      hostname.startsWith('.') ||
      hostname.endsWith('.')
    ) {
      return false;
    }

    if (hostname.length > 253) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
// function isValidDomain(domain: string): boolean {
//   const domainRegex =
//     /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
//   return domainRegex.test(domain);
// }
const ISSUER_HOST = process.env.VC_ISSUER_HOST;
if (!ISSUER_HOST) {
  throw new Error('VC_ISSUER_HOST environment variable is required');
}
if (!isValidDomain(ISSUER_HOST)) {
  throw new Error(`Invalid domain: ${ISSUER_HOST}`);
}
// const ISSUER_HOST = process.env.VC_ISSUER_HOST ?? 'au.edu';
export const ISSUER_DID = `did:web:${ISSUER_HOST}:issuer:academic`;
export const ISSUER_BASE_URL = `https://${ISSUER_HOST}`;
export const ACADEMIC_TRANSCRIPT_VCT =
  'urn:vc+sd-jwt:th:education:academic-transcript';

@Injectable()
export class VcService implements OnModuleInit {
  private sdjwt!: SDJwtVcInstance;
  private privateKeyObj!: KeyObject;
  public publicJwk: any;
  private readonly credentialValiditySeconds = 60 * 60 * 24 * 30;

  async onModuleInit() {
    const existingJwk = process.env.VC_ISSUER_PRIVATE_KEY_JWK;

    let privateKey: CryptoKey;
    let publicKey: CryptoKey;

    if (existingJwk) {
      const jwk = JSON.parse(existingJwk);
      privateKey = (await importJWK(jwk, 'ES256')) as CryptoKey;
      publicKey = (await importJWK(
        { ...jwk, d: undefined, key_ops: ['verify'] },
        'ES256',
      )) as CryptoKey;
    } else {
      const generated = await generateKeyPair('ES256', { extractable: true });
      privateKey = generated.privateKey;
      publicKey = generated.publicKey;

      const privateJwk = await exportJWK(privateKey);
      console.warn(
        '[VcService] No VC_ISSUER_PRIVATE_KEY_JWK set — generated a new key. ' +
          'Set this env var to persist it across restarts:\n' +
          JSON.stringify(privateJwk),
      );
    }
    this.privateKeyObj = KeyObject.from(privateKey);
    this.publicJwk = await exportJWK(publicKey);
    this.publicJwk.kid = 'au-wallet-key-1';
    this.publicJwk.alg = 'ES256';
    this.publicJwk.use = 'sig';

    this.sdjwt = new SDJwtVcInstance({
      signer: async (data: string) => {
        const sig = cryptoSign('sha256', Buffer.from(data), {
          key: this.privateKeyObj,
          dsaEncoding: 'der',
        });
        return derToJose(sig, 32);
      },
      signAlg: 'ES256',
      hasher: digest,
      hashAlg: 'sha-256', // must be lowercase, exact string
      saltGenerator: generateSalt,
    });
  }

  async issueAcademicTranscript(
    student: AcademicTranscriptClaims,
    holderPublicJwk: Record<string, any>,
  ): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1000);
    const validUntil = issuedAt + this.credentialValiditySeconds;

    const claims: Record<string, any> = {
      iss: ISSUER_DID,
      iat: issuedAt,
      nbf: issuedAt,
      exp: validUntil,
      validFrom: new Date(issuedAt * 1000).toISOString(),
      validUntil: new Date(validUntil * 1000).toISOString(),
      vct: ACADEMIC_TRANSCRIPT_VCT,
      issuing_institution: {
        name: 'Assumption University of Thailand',
        country: 'TH',
      },
      cnf: { jwk: holderPublicJwk },
      ...student,
    };

    const disclosureFrame: any = {
      _sd: [
        'name',
        'student_id',
        'degree_name',
        'major',
        'section',
        'gpa',
        'academic_standing',
      ],
    };

    return this.sdjwt.issue(claims as any, disclosureFrame);
  }
}
