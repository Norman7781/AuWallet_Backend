import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { SDJwtVcInstance } from '@sd-jwt/sd-jwt-vc';

import { digest, generateSalt } from '@sd-jwt/crypto-nodejs';

import { exportJWK, generateKeyPair, importJWK, type JWK } from 'jose';

import { KeyObject, sign as cryptoSign } from 'node:crypto';

import { promises as fs } from 'node:fs';

import { URL } from 'node:url';

import { AcademicTranscriptClaims } from './Academic_tran_type';

import { derToJose } from './Vc_Cyto';

const logger = new Logger('VcService');

function isValidDomain(domain: string): boolean {
  if (!domain || /\s/.test(domain)) {
    return false;
  }

  try {
    const parsed = new URL(`https://${domain}`);

    const normalizedInput = domain.toLowerCase();

    // VC_ISSUER_HOST is a host[:port], not a URL. Reject paths, credentials,

    // query strings, fragments, etc. rather than silently discarding them.

    if (parsed.host.toLowerCase() !== normalizedInput) {
      return false;
    }

    const hostname = parsed.hostname;

    if (!hostname.includes('.')) {
      return false;
    }

    if (
      hostname.includes('..') ||
      hostname.startsWith('.') ||
      hostname.endsWith('.') ||
      hostname.length > 253
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function resolveIssuerBaseUrl(): string {
  const configuredBaseUrl = process.env.VC_ISSUER_BASE_URL?.trim();

  if (configuredBaseUrl) {
    const parsedUrl = new URL(configuredBaseUrl);

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('VC_ISSUER_BASE_URL must use http or https');
    }

    if (
      process.env.NODE_ENV === 'production' &&
      parsedUrl.protocol !== 'https:'
    ) {
      throw new Error('VC_ISSUER_BASE_URL must use https in production');
    }

    if (parsedUrl.username || parsedUrl.password) {
      throw new Error('VC_ISSUER_BASE_URL must not contain credentials');
    }

    if (
      (parsedUrl.pathname && parsedUrl.pathname !== '/') ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      throw new Error(
        'VC_ISSUER_BASE_URL must be an origin URL without a path, query, or fragment',
      );
    }

    return parsedUrl.origin;
  }

  const configuredHost = process.env.VC_ISSUER_HOST?.trim();

  if (configuredHost) {
    if (!isValidDomain(configuredHost)) {
      throw new Error(`Invalid domain: ${configuredHost}`);
    }

    return `https://${configuredHost}`;
  }

  const port = process.env.PORT?.trim() || '3000';

  return `http://localhost:${port}`;
}

function toDidWebHost(baseUrl: string): string {
  // did:web encodes a ':' in host:port as %3A. Without this, a local URL such

  // as localhost:3000 would be interpreted as an extra DID path segment.

  return new URL(baseUrl).host.replace(/:/g, '%3A');
}

export const ISSUER_BASE_URL = resolveIssuerBaseUrl();

export const ISSUER_DID = `did:web:${toDidWebHost(ISSUER_BASE_URL)}:issuer:academic`;

export const ACADEMIC_TRANSCRIPT_VCT =
  'urn:vc+sd-jwt:th:education:academic-transcript';

const SIGNING_KEY_FRAGMENT = 'key-1';

export const SIGNING_KEY_ID = `${ISSUER_DID}#${SIGNING_KEY_FRAGMENT}`;

interface LoadedSigningKey {
  privateKey: CryptoKey;

  publicJwk: JWK;
}

function assertEs256PrivateJwk(jwk: unknown): asserts jwk is JWK {
  if (!jwk || typeof jwk !== 'object' || Array.isArray(jwk)) {
    throw new Error('VC_ISSUER_PRIVATE_KEY_JWK must be a JWK object');
  }

  const candidate = jwk as JWK;

  if (candidate.kty !== 'EC' || candidate.crv !== 'P-256') {
    throw new Error(
      'VC_ISSUER_PRIVATE_KEY_JWK must be an EC key on curve P-256 (ES256)',
    );
  }

  if (!candidate.d) {
    throw new Error(
      'VC_ISSUER_PRIVATE_KEY_JWK has no private key component (d) — ' +
        'a public-only JWK was supplied',
    );
  }
}

function toPublicJwk(privateJwk: JWK): JWK {
  const { d: _privateScalar, ...publicOnly } = privateJwk;

  return {
    ...publicOnly,

    key_ops: ['verify'],
  };
}

async function loadSigningKeyFromEnv(
  rawJwk: string,
): Promise<LoadedSigningKey> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJwk);
  } catch {
    throw new Error('VC_ISSUER_PRIVATE_KEY_JWK is not valid JSON');
  }

  assertEs256PrivateJwk(parsed);

  const privateKey = (await importJWK(parsed, 'ES256')) as CryptoKey;

  return {
    privateKey,

    publicJwk: toPublicJwk(parsed),
  };
}

async function loadOrCreateDevSigningKey(): Promise<LoadedSigningKey> {
  const devKeyPath = process.env.VC_DEV_KEY_PATH ?? '.dev-issuer-key.json';

  try {
    const cachedRaw = await fs.readFile(devKeyPath, 'utf8');

    const cached = await loadSigningKeyFromEnv(cachedRaw);

    logger.warn(
      `Loaded a dev-only signing key from ${devKeyPath}. This path must never be reached in production.`,
    );

    return cached;
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      // File exists but is unreadable/corrupt — fail loudly rather than

      // silently minting a new key and invalidating prior dev credentials.

      throw new Error(
        `Failed to read cached dev signing key at ${devKeyPath}: ${err?.message ?? err}`,
      );
    }
  }

  const generated = await generateKeyPair('ES256', { extractable: true });

  const privateJwk = await exportJWK(generated.privateKey);

  await fs.writeFile(devKeyPath, JSON.stringify(privateJwk), {
    mode: 0o600,
  });

  logger.warn(
    `No VC_ISSUER_PRIVATE_KEY_JWK set — generated a new dev-only key and saved it to ${devKeyPath} ` +
      '(add this path to .gitignore). The key material itself is never logged. ' +
      'Set VC_ISSUER_PRIVATE_KEY_JWK from a secrets manager before deploying.',
  );

  return {
    privateKey: generated.privateKey,

    publicJwk: toPublicJwk(privateJwk),
  };
}

async function loadSigningKey(): Promise<LoadedSigningKey> {
  const existingJwk = process.env.VC_ISSUER_PRIVATE_KEY_JWK?.trim();

  if (existingJwk) {
    return loadSigningKeyFromEnv(existingJwk);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'VC_ISSUER_PRIVATE_KEY_JWK is required when NODE_ENV=production. ' +
        'Generate an ES256 key pair and provision it via your secrets manager / KMS — ' +
        'do not rely on ephemeral key generation outside local development.',
    );
  }

  return loadOrCreateDevSigningKey();
}

export class InvalidHolderKeyError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'InvalidHolderKeyError';
  }
}

const SUPPORTED_HOLDER_KEY_TYPES = new Set(['EC', 'OKP', 'RSA']);

const PRIVATE_JWK_MEMBERS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'] as const;

function getHolderJwkImportAlgorithm(jwk: Record<string, unknown>): string {
  switch (jwk.kty) {
    case 'EC':
      switch (jwk.crv) {
        case 'P-256':
          return 'ES256';

        case 'P-384':
          return 'ES384';

        case 'P-521':
          return 'ES512';

        default:
          throw new InvalidHolderKeyError(
            `unsupported EC holder curve: ${String(jwk.crv)}`,
          );
      }

    case 'OKP':
      if (jwk.crv === 'Ed25519' || jwk.crv === 'Ed448') {
        return 'EdDSA';
      }

      throw new InvalidHolderKeyError(
        `unsupported OKP holder curve: ${String(jwk.crv)}`,
      );

    case 'RSA':
      // The import algorithm is only used to validate/import the public RSA

      // key. The PoP service remains responsible for verifying the JWT's

      // actual protected-header alg.

      return 'RS256';

    default:
      throw new InvalidHolderKeyError(
        `unsupported or missing holder key type: ${String(jwk.kty)}`,
      );
  }
}

/**

* Validates a holder-supplied JWK before it is embedded in cnf.jwk.

*

* The function rejects private-key members, imports the public key through

* jose for structural validation, and then exports it again. Re-exporting is

* intentional: it gives us a canonical public JWK instead of signing the

* holder's original arbitrary JSON object into the credential.

*/

async function validateAndNormalizeHolderJwk(
  jwk: Record<string, unknown> | undefined | null,
): Promise<JWK> {
  if (!jwk || typeof jwk !== 'object' || Array.isArray(jwk)) {
    throw new InvalidHolderKeyError(
      'holder public key is missing or malformed',
    );
  }

  if (PRIVATE_JWK_MEMBERS.some((member) => member in jwk)) {
    throw new InvalidHolderKeyError(
      'holder public key must not contain private key material',
    );
  }

  if (typeof jwk.kty !== 'string' || !SUPPORTED_HOLDER_KEY_TYPES.has(jwk.kty)) {
    throw new InvalidHolderKeyError(
      `unsupported or missing holder key type: ${String(jwk.kty)}`,
    );
  }

  const importAlgorithm = getHolderJwkImportAlgorithm(jwk);

  try {
    const imported = await importJWK(jwk as JWK, importAlgorithm);

    return await exportJWK(imported);
  } catch (err) {
    if (err instanceof InvalidHolderKeyError) {
      throw err;
    }

    throw new InvalidHolderKeyError(
      'holder public key is not a structurally valid JWK',
    );
  }
}

@Injectable()
export class VcService implements OnModuleInit {
  private sdjwt!: SDJwtVcInstance;

  private privateKeyObj!: KeyObject;

  public publicJwk!: JWK;

  private readonly credentialValiditySeconds = 60 * 60 * 24 * 30;

  async onModuleInit() {
    const { privateKey, publicJwk } = await loadSigningKey();

    this.privateKeyObj = KeyObject.from(privateKey);

    this.publicJwk = {
      ...publicJwk,

      kid: SIGNING_KEY_FRAGMENT,

      alg: 'ES256',

      use: 'sig',
    };

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

      hashAlg: 'sha-256',

      saltGenerator: generateSalt,
    });
  }

  async issueAcademicTranscript(
    transcript: AcademicTranscriptClaims,

    holderPublicJwk: Record<string, unknown>,
  ): Promise<string> {
    const normalizedHolderJwk =
      await validateAndNormalizeHolderJwk(holderPublicJwk);

    const issuedAt = Math.floor(Date.now() / 1000);

    const validUntil = issuedAt + this.credentialValiditySeconds;

    const claims: Record<string, unknown> = {
      iss: ISSUER_DID,

      iat: issuedAt,

      nbf: issuedAt,

      exp: validUntil,

      validFrom: new Date(issuedAt * 1000).toISOString(),

      validUntil: new Date(validUntil * 1000).toISOString(),

      vct: ACADEMIC_TRANSCRIPT_VCT,

      issuer: {
        id: ISSUER_DID,

        name: 'Assumption University of Thailand',
      },

      cnf: {
        jwk: normalizedHolderJwk,
      },

      // Nested sections mirror credentialSubject_type in the schema.

      documentContext: transcript.documentContext,

      documentInformation: transcript.documentInformation,

      student: transcript.student,

      educationalOrganization: transcript.educationalOrganization,

      courseList: transcript.courseList,

      academicSummary: transcript.academicSummary,

      additionalInformation: transcript.additionalInformation ?? [],
    };

    // Each top-level section is independently selectively disclosable. Fields

    // within a section are not individually disclosed by this frame.

    const disclosureFrame: any = {
      _sd: [
        'documentContext',

        'documentInformation',

        'student',

        'educationalOrganization',

        'courseList',

        'academicSummary',

        'additionalInformation',
      ],
    };

    return this.sdjwt.issue(claims as any, disclosureFrame, {
      header: {
        typ: 'dc+sd-jwt',

        kid: SIGNING_KEY_ID,
      },
    });
  }
}
