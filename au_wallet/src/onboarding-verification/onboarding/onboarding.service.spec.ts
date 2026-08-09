import { NotFoundException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

const connectionResponse = {
  data: {
    issuerCode: 'assumption-university',
    displayName: 'Assumption University',
    connectionStatus: 'verified' as const,
    latestVerificationStatus: 'matched' as const,
    rejectionReason: null,
    submittedAt: '2026-08-09T01:00:00.000Z',
    reviewedAt: null,
    verifiedAt: '2026-08-09T01:00:00.000Z',
  },
  message: 'Issuer connection verified.',
  meta: {} as Record<string, never>,
};

describe('OnboardingService compatibility alias', () => {
  it('delegates automatic AU verification without old activation semantics', async () => {
    const issuerConnections = {
      submitVerification: jest.fn().mockResolvedValue(connectionResponse),
      getConnection: jest.fn(),
    };
    const service = new OnboardingService(issuerConnections as never);
    const dto = {
      admissionNo: 'SYNTHETIC-ID',
      dateOfBirth: '2000-01-01',
      passportNumber: 'synthetic-passport-input',
    };

    await expect(service.submit(5, dto)).resolves.toEqual(connectionResponse);
    expect(issuerConnections.submitVerification).toHaveBeenCalledWith(
      5,
      'assumption-university',
      dto,
    );
  });

  it('delegates legacy current-request lookup to the AU connection', async () => {
    const issuerConnections = {
      submitVerification: jest.fn(),
      getConnection: jest.fn().mockResolvedValue(connectionResponse),
    };
    const service = new OnboardingService(issuerConnections as never);

    await expect(service.getMine(5)).resolves.toMatchObject({
      data: {
        issuerCode: 'assumption-university',
        connectionStatus: 'verified',
        latestVerificationStatus: 'matched',
      },
    });
  });

  it('preserves the provider connection not-found response', async () => {
    const issuerConnections = {
      submitVerification: jest.fn(),
      getConnection: jest.fn().mockRejectedValue(
        new NotFoundException({
          code: 'ISSUER_VERIFICATION_NOT_FOUND',
          message: 'No issuer connection was found.',
        }),
      ),
    };
    const service = new OnboardingService(issuerConnections as never);

    await expect(service.getMine(5)).rejects.toBeInstanceOf(NotFoundException);
  });
});
