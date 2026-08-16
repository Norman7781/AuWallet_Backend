import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { randomInt, randomUUID, createHash } from 'node:crypto';
import {
  VcService,
  ISSUER_DID,
  ISSUER_BASE_URL,
  ACADEMIC_TRANSCRIPT_VCT,
} from './Vc_Service';
import { IssuanceRepository } from './Issuance_repo';
import { ProofOfPossessionService } from './proof-of-possession_service';
import { CreateAcademicTranscriptOfferDto } from './dto/create-academic-transcript-offer.dto';

function hashTxCode(txCode: string): string {
  return createHash('sha256').update(txCode).digest('hex');
}

@Controller()
export class VcIssuanceController {
  constructor(
    private readonly vcService: VcService,
    private readonly issuanceRepo: IssuanceRepository,
    private readonly popService: ProofOfPossessionService,
  ) {}

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
    const preAuthCode = randomUUID();
    const cNonce = randomUUID();
    const txCode = randomInt(100000, 999999).toString();
    await this.issuanceRepo.savePendingOffer(dto, preAuthCode, cNonce, txCode);

    const offer = {
      credential_issuer: ISSUER_DID,
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
  // Only works while status is 'pending' or 'token_issued' (not yet claimed).
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
    if (!code) throw new BadRequestException('missing pre-authorized_code');
    if (!txCode) throw new BadRequestException('missing tx_code');

    const offer = await this.issuanceRepo.findPendingByCode(code);
    if (!offer || offer.status !== 'pending') {
      throw new UnauthorizedException('invalid_grant');
    }
    if (hashTxCode(txCode) !== offer.tx_code_hash) {
      throw new UnauthorizedException('invalid_grant');
    }

    const accessToken = randomUUID();
    const cNonce = randomUUID();
    await this.issuanceRepo.attachAccessToken(code, accessToken, cNonce);

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 300,
      c_nonce: cNonce,
      c_nonce_expires_in: 300,
    };
  }

  // Step 3: wallet redeems the access token for the actual credential.
  @Post('credentials/issue')
  async issue(
    @Headers('authorization') auth: string,
    @Body() body: { proof?: { proof_type: string; jwt: string } },
  ) {
    const token = auth?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('invalid_token');

    const offer = await this.issuanceRepo.findByAccessToken(token);
    if (!offer || offer.status !== 'pending') {
      throw new UnauthorizedException('invalid_token');
    }
    if (!offer.cNonce) {
      throw new BadRequestException('no active nonce for this offer');
    }
    if (!body.proof?.jwt) {
      throw new BadRequestException('missing proof-of-possession JWT');
    }

    const holderPublicJwk = await this.popService.verifyAndExtractKey(
      body.proof.jwt,
      ISSUER_DID,
      offer.cNonce,
    );

    const credential = await this.vcService.issueAcademicTranscript(
      offer.claims,
      holderPublicJwk,
    );
    await this.issuanceRepo.markIssued(offer.code);

    return { credential, format: 'dc+sd-jwt' };
  }
}
