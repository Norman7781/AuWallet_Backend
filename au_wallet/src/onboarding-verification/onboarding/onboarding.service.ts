import { Injectable } from '@nestjs/common';
import { CreateOnboardingRequestDto } from './dto/create-onboarding-request.dto';
import {
  ASSUMPTION_UNIVERSITY_ISSUER_CODE,
  IssuerConnectionService,
} from '../issuer-connections/issuer-connection.service';

@Injectable()
export class OnboardingService {
  constructor(private readonly issuerConnections: IssuerConnectionService) {}

  async submit(holderAccountId: number, dto: CreateOnboardingRequestDto) {
    return this.issuerConnections.submitVerification(
      holderAccountId,
      ASSUMPTION_UNIVERSITY_ISSUER_CODE,
      dto,
    );
  }

  async getMine(holderAccountId: number) {
    return this.issuerConnections.getConnection(
      holderAccountId,
      ASSUMPTION_UNIVERSITY_ISSUER_CODE,
    );
  }
}
