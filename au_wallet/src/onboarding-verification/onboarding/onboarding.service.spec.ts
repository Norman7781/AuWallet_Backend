import { ConflictException, NotFoundException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

const provider = {
  issuerProviderId: 10,
  issuerCode: 'assumption-university',
  displayName: 'Assumption University',
  description: 'Prototype provider',
  availability: 'available' as const,
  connectionVerificationEnabled: true,
  isMock: true,
};

const request = {
  onboardingRequestId: 123,
  holderAccountId: 5,
  holderIssuerConnectionId: 20,
  verificationStatus: 'matched' as const,
  matchedEnrollmentId: 40,
  rejectionReason: null,
  reviewedAt: null,
  submittedAt: '2026-08-09T01:00:00.000Z',
};

const verifiedConnection = {
  holderIssuerConnectionId: 20,
  holderAccountId: 5,
  issuerProviderId: 10,
  connectionStatus: 'verified' as const,
  verifiedAt: '2026-08-09T01:00:01.000Z',
  createdAt: '2026-08-09T01:00:00.000Z',
  updatedAt: '2026-08-09T01:00:01.000Z',
};

const dto = {
  admissionNo: 'SYNTHETIC-ID',
  dateOfBirth: '2000-01-01',
  passportNumber: 'synthetic-passport-input',
};

function createService() {
  const issuerConnections = {
    submitVerification: jest.fn().mockResolvedValue({}),
  };
  const providers = {
    findByCode: jest.fn().mockResolvedValue(provider),
  };
  const connections = {
    findByHolderAndProvider: jest.fn().mockResolvedValue(verifiedConnection),
  };
  const requests = {
    findLatestByConnectionId: jest.fn().mockResolvedValue(request),
  };
  const service = new OnboardingService(
    issuerConnections as never,
    providers as never,
    connections as never,
    requests as never,
  );

  return { service, issuerConnections, providers, connections, requests };
}

describe('OnboardingService wallet compatibility adapter', () => {
  it('maps an existing verified AU connection to the wallet matched contract', async () => {
    const { service } = createService();

    await expect(service.getMine(5)).resolves.toEqual({
      data: {
        onboardingRequestId: 123,
        verificationStatus: 'matched',
        rejectionReason: null,
        reviewedAt: verifiedConnection.verifiedAt,
        submittedAt: request.submittedAt,
      },
      message: 'AU verification status loaded.',
      meta: {},
    });
  });

  it('returns the accepted generic rejection contract', async () => {
    const { service, connections, requests } = createService();
    connections.findByHolderAndProvider.mockResolvedValue({
      ...verifiedConnection,
      connectionStatus: 'rejected',
      verifiedAt: null,
    });
    requests.findLatestByConnectionId.mockResolvedValue({
      ...request,
      verificationStatus: 'rejected',
      matchedEnrollmentId: null,
      rejectionReason: 'ISSUER_VERIFICATION_NOT_CONFIRMED',
    });

    await expect(service.getMine(5)).resolves.toMatchObject({
      data: {
        onboardingRequestId: 123,
        verificationStatus: 'rejected',
        rejectionReason: 'IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED',
        reviewedAt: request.submittedAt,
      },
    });
  });

  it('maps a real active verification to under_review', async () => {
    const { service, connections, requests } = createService();
    connections.findByHolderAndProvider.mockResolvedValue({
      ...verifiedConnection,
      connectionStatus: 'pending_verification',
      verifiedAt: null,
    });
    requests.findLatestByConnectionId.mockResolvedValue({
      ...request,
      verificationStatus: 'under_review',
      matchedEnrollmentId: null,
    });

    await expect(service.getMine(5)).resolves.toMatchObject({
      data: {
        verificationStatus: 'under_review',
        rejectionReason: null,
        reviewedAt: null,
      },
    });
  });

  it.each([null, { ...verifiedConnection, connectionStatus: 'disconnected' }])(
    'returns wallet-compatible NOT_FOUND for absent or disconnected state',
    async (connection) => {
      const { service, connections } = createService();
      connections.findByHolderAndProvider.mockResolvedValue(connection);

      await expect(service.getMine(5)).rejects.toMatchObject({
        constructor: NotFoundException,
        response: { code: 'NOT_FOUND' },
      });
    },
  );

  it('submits through corrected automatic AU verification and returns matched immediately', async () => {
    const { service, issuerConnections, connections } = createService();
    connections.findByHolderAndProvider
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(verifiedConnection);

    await expect(service.submit(5, dto)).resolves.toMatchObject({
      data: {
        onboardingRequestId: 123,
        verificationStatus: 'matched',
      },
      message: 'AU verification completed.',
    });
    expect(issuerConnections.submitVerification).toHaveBeenCalledWith(
      5,
      'assumption-university',
      dto,
    );
  });

  it('returns an existing matched result without reprocessing identity input', async () => {
    const { service, issuerConnections } = createService();

    await expect(service.submit(5, dto)).resolves.toMatchObject({
      data: { verificationStatus: 'matched' },
      message: 'AU verification already matched.',
    });
    expect(issuerConnections.submitVerification).not.toHaveBeenCalled();
  });

  it('maps active verification conflicts to the old wallet error code', async () => {
    const { service, connections, requests } = createService();
    connections.findByHolderAndProvider.mockResolvedValue({
      ...verifiedConnection,
      connectionStatus: 'pending_verification',
      verifiedAt: null,
    });
    requests.findLatestByConnectionId.mockResolvedValue({
      ...request,
      verificationStatus: 'under_review',
      matchedEnrollmentId: null,
    });

    await expect(service.submit(5, dto)).rejects.toMatchObject({
      constructor: ConflictException,
      response: { code: 'ONBOARDING_REQUEST_ACTIVE' },
    });
  });

  it('maps a concurrent corrected-flow active conflict to the old wallet code', async () => {
    const { service, issuerConnections, connections } = createService();
    connections.findByHolderAndProvider.mockResolvedValue(null);
    issuerConnections.submitVerification.mockRejectedValue(
      new ConflictException({
        code: 'ISSUER_VERIFICATION_ACTIVE',
        message: 'An active issuer verification already exists.',
      }),
    );

    await expect(service.submit(5, dto)).rejects.toMatchObject({
      response: { code: 'ONBOARDING_REQUEST_ACTIVE' },
    });
  });

  it('requires the configured AU provider without exposing database IDs', async () => {
    const { service, providers } = createService();
    providers.findByCode.mockResolvedValue(null);

    await expect(service.getMine(5)).rejects.toMatchObject({
      response: { code: 'ISSUER_NOT_FOUND' },
    });
  });
});
