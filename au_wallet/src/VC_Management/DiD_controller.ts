import { Controller, Get } from '@nestjs/common';
import { VcService, ISSUER_DID } from './Vc_Service';

// Path matters: did:web:au.edu:issuer:academic resolves to
// https://au.edu/.well-known/issuer/academic/did.json
@Controller('issuer/academic')
export class DidWebController {
  constructor(private readonly vcService: VcService) {}

  @Get('did.json')
  getDidDocument() {
    return {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: ISSUER_DID,
      verificationMethod: [
        {
          id: `${ISSUER_DID}#key-1`,
          type: 'JsonWebKey2020',
          controller: ISSUER_DID,
          publicKeyJwk: this.vcService.publicJwk,
        },
      ],
      assertionMethod: [`${ISSUER_DID}#key-1`],
    };
  }
}
