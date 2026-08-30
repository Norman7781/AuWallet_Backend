import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import {
  ACADEMIC_TRANSCRIPT_VCT,
  InvalidHolderKeyError,
  ISSUER_BASE_URL,
  ISSUER_DID,
  SIGNING_KEY_ID,
  VcService,
} from './Vc_Service';
import { IssuanceRepository } from './Issuance_repo';
import { ProofOfPossessionService } from './proof-of-possession_service';
import { StudentAcademicService } from './student-academic_service';
import { buildAcademicTranscriptClaims } from './academic-transcript_builder';
import {
  SchemaValidationError,
  validateAcademicTranscriptClaims,
} from './Schema_Validator';
import { CreateAcademicTranscriptOfferDto } from './dto/create-academic-transcript-offer.dto';

const ACCESS_TOKEN_LIFETIME_SECONDS = 300;
const C_NONCE_LIFETIME_SECONDS = 300;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

function hashTxCode(txCode: string): string {
  return createHash('sha256').update(txCode, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of the presented tx_code against the stored hash.
 * A normal string comparison can reveal timing information about matching
 * prefixes. The stored value is validated first so timingSafeEqual always
 * receives two 32-byte SHA-256 digests.
 */
function verifyTxCode(presentedTxCode: string, expectedHash: string): boolean {
  if (!SHA256_HEX_PATTERN.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashTxCode(presentedTxCode), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return timingSafeEqual(actual, expected);
}

function extractBearerToken(authorization?: string): string | null {
  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

function isRedeemableStatus(status: string): boolean {
  // Keep compatibility with repositories that either leave the offer as
  // "pending" after attaching the token or transition it to "token_issued".
  return status === 'pending' || status === 'token_issued';
}

@Controller()
export class VcIssuanceController {
  constructor(
    private readonly vcService: VcService,
    private readonly issuanceRepo: IssuanceRepository,
    private readonly popService: ProofOfPossessionService,
    private readonly studentAcademicService: StudentAcademicService,
  ) {}

  /**
   * did:web resolution:
   *
   * did:web:au.edu:issuer:academic
   *   -> https://au.edu/issuer/academic/did.json
   *
   * The .well-known path is only used for a did:web identifier with no path
   * segments. If main.ts uses a global prefix such as "api", this route must
   * be excluded from that prefix or the DID will no longer resolve correctly.
   */
  @Get('issuer/academic/did.json')
  getIssuerDidDocument() {
    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
      ],
      id: ISSUER_DID,
      verificationMethod: [
        {
          id: SIGNING_KEY_ID,
          type: 'JsonWebKey2020',
          controller: ISSUER_DID,
          publicKeyJwk: this.vcService.publicJwk,
        },
      ],
      assertionMethod: [SIGNING_KEY_ID],
    };
  }

  // OID4VCI issuer metadata — wallet fetches this first to discover
  // what credentials this issuer offers and where the endpoints are.
  @Get('.well-known/openid-credential-issuer')
  getIssuerMetadata() {
    return {
      credential_issuer: ISSUER_BASE_URL,
      credential_endpoint: `${ISSUER_BASE_URL}/credentials/issue`,
      token_endpoint: `${ISSUER_BASE_URL}/token`,
      credential_configurations_supported: {
        AcademicTranscriptCredential: {
          format: 'dc+sd-jwt',
          vct: ACADEMIC_TRANSCRIPT_VCT,
          claims: {
            documentContext: {},
            documentInformation: {},
            student: {},
            educationalOrganization: {},
            courseList: {},
            academicSummary: {},
            additionalInformation: {},
          },
        },
      },
    };
  }

  // Step 1: registrar/admin action — call this once a transcript record is final.
  // Returns the deep-link/QR payload to hand to the student.
  @Post('credentials/offers')
  async createOffer(@Body() dto: CreateAcademicTranscriptOfferDto) {
    return this.createAcademicTranscriptOffer(dto);
  }

  // Frontend-friendly route for the create button.
  @Post('vc/academic-transcripts/create')
  async createAcademicTranscriptOffer(
    @Body() dto: CreateAcademicTranscriptOfferDto,
  ) {
    const record = await this.studentAcademicService.getFullAcademicRecord(
      dto.studentNumber,
    );
    const claims = buildAcademicTranscriptClaims(record);

    try {
      validateAcademicTranscriptClaims(claims);
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        throw new BadRequestException({
          message: 'Built transcript claims failed schema validation',
          errors: err.errors,
        });
      }
      throw err;
    }

    const preAuthCode = randomUUID();
    const cNonce = randomUUID();
    // randomInt() uses an exclusive upper bound, so 1_000_000 is required
    // to make 999999 reachable.
    const txCode = randomInt(100000, 1000000).toString();

    await this.issuanceRepo.savePendingOffer(
      claims,
      preAuthCode,
      cNonce,
      txCode,
    );

    const offer = {
      // OID4VCI credential_issuer is the issuer URL, not the signing DID.
      credential_issuer: ISSUER_BASE_URL,
      credential_configuration_ids: ['AcademicTranscriptCredential'],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': preAuthCode,
          tx_code: {
            input_mode: 'numeric',
            length: 6,
            description: 'Enter the PIN sent to your student email',
          },
        },
      },
    };

    return {
      credential_offer_uri: `openid-credential-offer://?credential_offer=${encodeURIComponent(
        JSON.stringify(offer),
      )}`,
      tx_code: txCode,
    };
  }

  // Admin action — cancel an offer before the holder claims it.
  @Post('credentials/offers/:code/revoke')
  async revokeOffer(@Param('code') code: string) {
    const offer = await this.issuanceRepo.findPendingByCode(code);

    if (!offer) {
      throw new NotFoundException('offer not found');
    }

    if (offer.status === 'issued') {
      throw new BadRequestException(
        'credential already claimed — cannot revoke',
      );
    }

    await this.issuanceRepo.markRevoked(code);
    return { code, status: 'revoked' };
  }

  // Step 2: wallet exchanges the pre-authorized_code for an access token.
  @Post('token')
  async token(
    @Body('pre-authorized_code') code: string,
    @Body('tx_code') txCode: string,
  ) {
    if (typeof code !== 'string' || code.length === 0) {
      throw new BadRequestException('missing pre-authorized_code');
    }

    if (typeof txCode !== 'string' || txCode.length === 0) {
      throw new BadRequestException('missing tx_code');
    }

    // Do not expose a different authentication error for malformed PINs.
    if (!/^\d{6}$/.test(txCode)) {
      throw new UnauthorizedException('invalid_grant');
    }

    const offer = await this.issuanceRepo.findPendingByCode(code);

    if (!offer || offer.status !== 'pending') {
      throw new UnauthorizedException('invalid_grant');
    }

    if (!verifyTxCode(txCode, offer.tx_code_hash)) {
      throw new UnauthorizedException('invalid_grant');
    }

    // 256 bits of random bearer-token entropy.
    const accessToken = randomBytes(32).toString('base64url');
    const cNonce = randomUUID();

    await this.issuanceRepo.attachAccessToken(code, accessToken, cNonce);

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
      c_nonce: cNonce,
      c_nonce_expires_in: C_NONCE_LIFETIME_SECONDS,
    };
  }

  // Step 3: wallet redeems the access token for the actual credential.
  @Post('credentials/issue')
  async issue(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: { proof?: { proof_type?: string; jwt?: string } },
  ) {
    const token = extractBearerToken(authorization);

    if (!token) {
      throw new UnauthorizedException('invalid_token');
    }

    const offer = await this.issuanceRepo.findByAccessToken(token);

    if (!offer || !isRedeemableStatus(offer.status)) {
      throw new UnauthorizedException('invalid_token');
    }

    if (!offer.cNonce) {
      throw new BadRequestException('no active nonce for this offer');
    }

    if (
      !body?.proof ||
      body.proof.proof_type !== 'jwt' ||
      typeof body.proof.jwt !== 'string' ||
      body.proof.jwt.length === 0
    ) {
      throw new BadRequestException(
        'missing or invalid proof-of-possession JWT',
      );
    }

    // In OID4VCI the proof JWT audience is the Credential Issuer identifier,
    // which is ISSUER_BASE_URL. ISSUER_DID remains the cryptographic issuer
    // identifier used inside the signed credential.
    const holderPublicJwk = await this.popService.verifyAndExtractKey(
      body.proof.jwt,
      ISSUER_BASE_URL,
      offer.cNonce,
    );

    let credential: string;

    try {
      credential = await this.vcService.issueAcademicTranscript(
        offer.claims,
        holderPublicJwk,
      );
    } catch (err) {
      if (err instanceof InvalidHolderKeyError) {
        throw new BadRequestException({
          error: 'invalid_proof',
          error_description: err.message,
        });
      }
      throw err;
    }

    await this.issuanceRepo.markIssued(offer.code);

    return {
      credential,
      format: 'dc+sd-jwt',
    };
  }
}
