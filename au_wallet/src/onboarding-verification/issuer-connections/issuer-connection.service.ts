import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOnboardingRequestDto } from '../onboarding/dto/create-onboarding-request.dto';
import type { OnboardingRequestRecord } from '../onboarding/onboarding-request.interface';
import { OnboardingRequestRepository } from '../onboarding/onboarding-request.repository';
import { StudentMatchingService } from '../student-matching/student-matching.service';
import { HolderIssuerConnectionRepository } from './holder-issuer-connection.repository';
import type {
  HolderIssuerConnectionRecord,
  IssuerConnectionListResponse,
  IssuerConnectionResponse,
  IssuerProviderListResponse,
  IssuerProviderRecord,
  PublicIssuerConnection,
} from './issuer-connection.interface';
import { IssuerProviderRepository } from './issuer-provider.repository';

export const ASSUMPTION_UNIVERSITY_ISSUER_CODE = 'assumption-university';

@Injectable()
export class IssuerConnectionService {
  constructor(
    private readonly providers: IssuerProviderRepository,
    private readonly connections: HolderIssuerConnectionRepository,
    private readonly requests: OnboardingRequestRepository,
    private readonly studentMatching: StudentMatchingService,
  ) {}

  async listProviders(
    holderAccountId: number,
  ): Promise<IssuerProviderListResponse> {
    const [providers, connections] = await Promise.all([
      this.providers.list(),
      this.connections.listByHolder(holderAccountId),
    ]);
    const byProvider = new Map(
      connections.map((connection) => [
        connection.issuerProviderId,
        connection.connectionStatus,
      ]),
    );

    return {
      data: providers.map((provider) => ({
        issuerCode: provider.issuerCode,
        displayName: provider.displayName,
        description: provider.description,
        availability: provider.availability,
        connectionEnabled: provider.connectionVerificationEnabled,
        isMock: provider.isMock,
        connectionStatus: byProvider.get(provider.issuerProviderId) ?? null,
      })),
      message: 'Issuer providers loaded.',
      meta: {},
    };
  }

  async listConnections(
    holderAccountId: number,
  ): Promise<IssuerConnectionListResponse> {
    const [providers, connections] = await Promise.all([
      this.providers.list(),
      this.connections.listByHolder(holderAccountId),
    ]);
    const providerById = new Map(
      providers.map((provider) => [provider.issuerProviderId, provider]),
    );
    const data = await Promise.all(
      connections.map(async (connection) => {
        const provider = providerById.get(connection.issuerProviderId);

        if (!provider) {
          throw new NotFoundException({
            code: 'ISSUER_NOT_FOUND',
            message: 'The issuer provider was not found.',
          });
        }

        return this.toPublic(
          provider,
          connection,
          await this.requests.findLatestByConnectionId(
            connection.holderIssuerConnectionId,
          ),
        );
      }),
    );

    return { data, message: 'Issuer connections loaded.', meta: {} };
  }

  async getConnection(
    holderAccountId: number,
    issuerCode: string,
  ): Promise<IssuerConnectionResponse> {
    const provider = await this.requireProvider(issuerCode);
    const connection = await this.connections.findByHolderAndProvider(
      holderAccountId,
      provider.issuerProviderId,
    );

    if (!connection) {
      throw new NotFoundException({
        code: 'ISSUER_VERIFICATION_NOT_FOUND',
        message: 'No issuer connection was found.',
      });
    }

    return {
      data: this.toPublic(
        provider,
        connection,
        await this.requests.findLatestByConnectionId(
          connection.holderIssuerConnectionId,
        ),
      ),
      message: 'Issuer connection loaded.',
      meta: {},
    };
  }

  async submitVerification(
    holderAccountId: number,
    issuerCode: string,
    dto: CreateOnboardingRequestDto,
  ): Promise<IssuerConnectionResponse> {
    const provider = await this.requireProvider(issuerCode);
    this.assertAvailable(provider);

    const prepared = await this.studentMatching.prepareAndMatch(dto);
    const result = await this.connections.submitVerification({
      holderAccountId,
      issuerCode: provider.issuerCode,
      admissionNo: dto.admissionNo.trim(),
      dateOfBirth: dto.dateOfBirth.trim(),
      passportNumberHmac: prepared.passportNumberHmac,
    });

    return {
      data: {
        issuerCode: provider.issuerCode,
        displayName: provider.displayName,
        connectionStatus: result.connectionStatus,
        latestVerificationStatus: result.verificationStatus,
        rejectionReason: result.rejectionReason,
        submittedAt: result.submittedAt,
        reviewedAt: result.reviewedAt,
        verifiedAt: result.verifiedAt,
      },
      message:
        result.connectionStatus === 'verified'
          ? 'Issuer connection verified.'
          : 'Issuer verification could not be confirmed.',
      meta: {},
    };
  }

  async findWalletConnectedByEnrollmentIds(
    enrollmentIds: number[],
  ): Promise<Map<number, boolean>> {
    const uniqueIds = [
      ...new Set(
        enrollmentIds.filter((id) => Number.isSafeInteger(id) && id > 0),
      ),
    ];
    const connectedIds =
      await this.connections.findVerifiedEnrollmentIdsByIssuerCode(
        ASSUMPTION_UNIVERSITY_ISSUER_CODE,
        uniqueIds,
      );

    return new Map(uniqueIds.map((id) => [id, connectedIds.has(id)]));
  }

  async isEnrollmentWalletConnected(enrollmentId: number): Promise<boolean> {
    const connected = await this.findWalletConnectedByEnrollmentIds([
      enrollmentId,
    ]);

    return connected.get(enrollmentId) ?? false;
  }

  private async requireProvider(
    issuerCodeInput: string,
  ): Promise<IssuerProviderRecord> {
    const issuerCode = issuerCodeInput.trim().toLowerCase();
    const provider = await this.providers.findByCode(issuerCode);

    if (!provider) {
      throw new NotFoundException({
        code: 'ISSUER_NOT_FOUND',
        message: 'The issuer provider was not found.',
      });
    }

    return provider;
  }

  private assertAvailable(provider: IssuerProviderRecord): void {
    if (
      provider.issuerCode !== ASSUMPTION_UNIVERSITY_ISSUER_CODE ||
      provider.availability !== 'available' ||
      !provider.connectionVerificationEnabled
    ) {
      throw new ConflictException({
        code: 'ISSUER_CONNECTION_NOT_AVAILABLE',
        message: 'Issuer connection verification is not available.',
      });
    }
  }

  private toPublic(
    provider: IssuerProviderRecord,
    connection: HolderIssuerConnectionRecord,
    request: OnboardingRequestRecord | null,
  ): PublicIssuerConnection {
    return {
      issuerCode: provider.issuerCode,
      displayName: provider.displayName,
      connectionStatus: connection.connectionStatus,
      latestVerificationStatus: request?.verificationStatus ?? null,
      rejectionReason: request?.rejectionReason ?? null,
      submittedAt: request?.submittedAt ?? null,
      reviewedAt: request?.reviewedAt ?? null,
      verifiedAt: connection.verifiedAt,
    };
  }
}
