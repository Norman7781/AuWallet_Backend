import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOnboardingRequestDto } from './dto/create-onboarding-request.dto';
import {
  ASSUMPTION_UNIVERSITY_ISSUER_CODE,
  IssuerConnectionService,
} from '../issuer-connections/issuer-connection.service';
import { IssuerProviderRepository } from '../issuer-connections/issuer-provider.repository';
import { HolderIssuerConnectionRepository } from '../issuer-connections/holder-issuer-connection.repository';
import { OnboardingRequestRepository } from './onboarding-request.repository';
import type {
  OnboardingRequestResponse,
  PublicOnboardingRequest,
} from './onboarding-request.interface';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly issuerConnections: IssuerConnectionService,
    private readonly providers: IssuerProviderRepository,
    private readonly connections: HolderIssuerConnectionRepository,
    private readonly requests: OnboardingRequestRepository,
  ) {}

  async submit(
    holderAccountId: number,
    dto: CreateOnboardingRequestDto,
  ): Promise<OnboardingRequestResponse> {
    const current = await this.findCurrent(holderAccountId);

    if (current?.verificationStatus === 'matched') {
      return this.toResponse(current, 'AU verification already matched.');
    }

    if (current?.verificationStatus === 'under_review') {
      throw this.activeRequestConflict();
    }

    try {
      await this.issuerConnections.submitVerification(
        holderAccountId,
        ASSUMPTION_UNIVERSITY_ISSUER_CODE,
        dto,
      );
    } catch (error: unknown) {
      const code = this.exceptionCode(error);

      if (code === 'ISSUER_CONNECTION_ALREADY_VERIFIED') {
        return this.getMine(holderAccountId);
      }

      if (code === 'ISSUER_VERIFICATION_ACTIVE') {
        throw this.activeRequestConflict();
      }

      throw error;
    }

    const completed = await this.requireCurrent(holderAccountId);
    return this.toResponse(completed, 'AU verification completed.');
  }

  async getMine(holderAccountId: number): Promise<OnboardingRequestResponse> {
    return this.toResponse(
      await this.requireCurrent(holderAccountId),
      'AU verification status loaded.',
    );
  }

  private async requireCurrent(
    holderAccountId: number,
  ): Promise<PublicOnboardingRequest> {
    const current = await this.findCurrent(holderAccountId);

    if (!current) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No AU verification request was found.',
      });
    }

    return current;
  }

  private async findCurrent(
    holderAccountId: number,
  ): Promise<PublicOnboardingRequest | null> {
    const provider = await this.providers.findByCode(
      ASSUMPTION_UNIVERSITY_ISSUER_CODE,
    );

    if (!provider) {
      throw new NotFoundException({
        code: 'ISSUER_NOT_FOUND',
        message: 'The issuer provider was not found.',
      });
    }

    const connection = await this.connections.findByHolderAndProvider(
      holderAccountId,
      provider.issuerProviderId,
    );

    if (!connection || connection.connectionStatus === 'disconnected') {
      return null;
    }

    const request = await this.requests.findLatestByConnectionId(
      connection.holderIssuerConnectionId,
    );

    if (!request) {
      return null;
    }

    const verificationStatus =
      connection.connectionStatus === 'verified'
        ? 'matched'
        : connection.connectionStatus === 'rejected'
          ? 'rejected'
          : 'under_review';
    const reviewedAt =
      verificationStatus === 'matched'
        ? (connection.verifiedAt ?? request.reviewedAt ?? request.submittedAt)
        : verificationStatus === 'rejected'
          ? (request.reviewedAt ?? request.submittedAt)
          : null;

    return {
      onboardingRequestId: request.onboardingRequestId,
      verificationStatus,
      rejectionReason:
        verificationStatus === 'rejected'
          ? 'IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED'
          : null,
      reviewedAt,
      submittedAt: request.submittedAt,
    };
  }

  private toResponse(
    data: PublicOnboardingRequest,
    message: string,
  ): OnboardingRequestResponse {
    return { data, message, meta: {} };
  }

  private activeRequestConflict(): ConflictException {
    return new ConflictException({
      code: 'ONBOARDING_REQUEST_ACTIVE',
      message: 'An active AU verification request already exists.',
    });
  }

  private exceptionCode(error: unknown): string | null {
    if (!(error instanceof HttpException)) return null;

    const response = error.getResponse();
    if (typeof response !== 'object' || response === null) return null;

    const code = (response as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
}
