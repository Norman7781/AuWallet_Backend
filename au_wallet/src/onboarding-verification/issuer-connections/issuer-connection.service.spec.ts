import { ConflictException, NotFoundException } from '@nestjs/common';
import { IssuerConnectionService } from './issuer-connection.service';

const auProvider = {
  issuerProviderId: 10,
  issuerCode: 'assumption-university',
  displayName: 'Assumption University',
  description: 'Prototype provider',
  availability: 'available' as const,
  connectionVerificationEnabled: true,
  isMock: true,
};

const alphaProvider = {
  issuerProviderId: 11,
  issuerCode: 'demo-issuer-alpha',
  displayName: 'Demo Issuer Alpha',
  description: 'Synthetic placeholder',
  availability: 'coming_soon' as const,
  connectionVerificationEnabled: false,
  isMock: true,
};

const betaProvider = {
  ...alphaProvider,
  issuerProviderId: 12,
  issuerCode: 'demo-issuer-beta',
  displayName: 'Demo Issuer Beta',
};

const matchedSubmission = {
  issuerCode: 'assumption-university',
  connectionStatus: 'verified' as const,
  verificationStatus: 'matched' as const,
  rejectionReason: null,
  submittedAt: '2026-08-09T02:00:00.000Z',
  reviewedAt: null,
  verifiedAt: '2026-08-09T02:00:00.000Z',
};

const rejectedSubmission = {
  issuerCode: 'assumption-university',
  connectionStatus: 'rejected' as const,
  verificationStatus: 'rejected' as const,
  rejectionReason: 'ISSUER_VERIFICATION_NOT_CONFIRMED',
  submittedAt: '2026-08-09T02:00:00.000Z',
  reviewedAt: null,
  verifiedAt: null,
};

function createService() {
  const providers = {
    list: jest
      .fn()
      .mockResolvedValue([auProvider, alphaProvider, betaProvider]),
    findByCode: jest
      .fn()
      .mockImplementation((code: string) =>
        Promise.resolve(
          [auProvider, alphaProvider, betaProvider].find(
            (provider) => provider.issuerCode === code,
          ) ?? null,
        ),
      ),
  };
  const connections = {
    listByHolder: jest.fn().mockResolvedValue([]),
    findByHolderAndProvider: jest.fn().mockResolvedValue(null),
    submitVerification: jest.fn().mockResolvedValue(matchedSubmission),
    findVerifiedEnrollmentIdsByIssuerCode: jest
      .fn()
      .mockResolvedValue(new Set([40, 41])),
  };
  const requests = {
    findLatestByConnectionId: jest.fn().mockResolvedValue(null),
  };
  const studentMatching = {
    prepareAndMatch: jest.fn().mockResolvedValue({
      passportNumberHmac: 'a'.repeat(64),
      result: {
        outcome: 'matched',
        studentId: 1,
        enrollmentId: 40,
        academicStatus: 'studying',
      },
    }),
  };
  const service = new IssuerConnectionService(
    providers as never,
    connections as never,
    requests as never,
    studentMatching as never,
  );

  return { service, providers, connections, requests, studentMatching };
}

const dto = {
  admissionNo: 'SYNTHETIC-ID',
  dateOfBirth: '2000-01-01',
  passportNumber: 'synthetic-input',
};

describe('IssuerConnectionService', () => {
  it('returns exactly three mock providers with only AU available', async () => {
    const { service } = createService();

    const response = await service.listProviders(5);

    expect(response.data).toHaveLength(3);
    expect(
      response.data.filter((provider) => provider.connectionEnabled),
    ).toEqual([
      expect.objectContaining({
        issuerCode: 'assumption-university',
        availability: 'available',
        isMock: true,
      }),
    ]);
    expect(
      response.data.every((provider) => !('issuerProviderId' in provider)),
    ).toBe(true);
  });

  it.each(['demo-issuer-alpha', 'demo-issuer-beta'])(
    'rejects verification for unavailable provider %s',
    async (issuerCode) => {
      const { service, connections } = createService();

      await expect(
        service.submitVerification(5, issuerCode, dto),
      ).rejects.toMatchObject({
        constructor: ConflictException,
        response: { code: 'ISSUER_CONNECTION_NOT_AVAILABLE' },
      });
      expect(connections.submitVerification).not.toHaveBeenCalled();
    },
  );

  it.each(['studying', 'graduated', 'alumni'])(
    'automatically verifies an exact eligible %s match',
    async (academicStatus) => {
      const { service, connections, studentMatching } = createService();
      studentMatching.prepareAndMatch.mockResolvedValue({
        passportNumberHmac: 'b'.repeat(64),
        result: {
          outcome: 'matched',
          studentId: 1,
          enrollmentId: 40,
          academicStatus,
        },
      });

      const response = await service.submitVerification(
        5,
        'assumption-university',
        dto,
      );

      expect(connections.submitVerification).toHaveBeenCalledWith({
        holderAccountId: 5,
        issuerCode: 'assumption-university',
        admissionNo: 'SYNTHETIC-ID',
        dateOfBirth: '2000-01-01',
        passportNumberHmac: 'b'.repeat(64),
      });
      expect(response).toEqual({
        data: {
          issuerCode: 'assumption-university',
          displayName: 'Assumption University',
          connectionStatus: 'verified',
          latestVerificationStatus: 'matched',
          rejectionReason: null,
          submittedAt: matchedSubmission.submittedAt,
          reviewedAt: null,
          verifiedAt: matchedSubmission.verifiedAt,
        },
        message: 'Issuer connection verified.',
        meta: {},
      });
      expect(JSON.stringify(response)).not.toMatch(
        /passport|hmac|enrollmentId|issuerProviderId|holderIssuerConnectionId|verificationRequestId/i,
      );
    },
  );

  it.each(['under_review', 'ineligible'])(
    'returns the same generic rejected outcome for a safe %s preliminary result',
    async (outcome) => {
      const { service, connections, studentMatching } = createService();
      studentMatching.prepareAndMatch.mockResolvedValue({
        passportNumberHmac: 'c'.repeat(64),
        result:
          outcome === 'under_review'
            ? { outcome, reason: 'no_exact_match' }
            : {
                outcome,
                studentId: 1,
                enrollmentId: 40,
                academicStatus: 'withdrawn',
              },
      });
      connections.submitVerification.mockResolvedValue(rejectedSubmission);

      const response = await service.submitVerification(
        5,
        'assumption-university',
        dto,
      );

      expect(response.data).toEqual(
        expect.objectContaining({
          connectionStatus: 'rejected',
          latestVerificationStatus: 'rejected',
          rejectionReason: 'ISSUER_VERIFICATION_NOT_CONFIRMED',
        }),
      );
      expect(JSON.stringify(response)).not.toMatch(
        /no_exact_match|withdrawn|passport|hmac|enrollmentId/i,
      );
    },
  );

  it('allows a corrected resubmission after rejection', async () => {
    const { service, connections } = createService();
    connections.submitVerification
      .mockResolvedValueOnce(rejectedSubmission)
      .mockResolvedValueOnce(matchedSubmission);

    await expect(
      service.submitVerification(5, 'assumption-university', dto),
    ).resolves.toMatchObject({ data: { connectionStatus: 'rejected' } });
    await expect(
      service.submitVerification(5, 'assumption-university', dto),
    ).resolves.toMatchObject({ data: { connectionStatus: 'verified' } });
  });

  it.each(['ISSUER_VERIFICATION_ACTIVE', 'ISSUER_CONNECTION_ALREADY_VERIFIED'])(
    'preserves the stable %s conflict',
    async (code) => {
      const { service, connections } = createService();
      connections.submitVerification.mockRejectedValue(
        new ConflictException({ code, message: 'Safe conflict.' }),
      );

      await expect(
        service.submitVerification(5, 'assumption-university', dto),
      ).rejects.toMatchObject({ response: { code } });
    },
  );

  it('provides single and batch AU wallet-connected lookups without N+1 calls', async () => {
    const { service, connections } = createService();

    await expect(
      service.findWalletConnectedByEnrollmentIds([40, 41, 42]),
    ).resolves.toEqual(
      new Map([
        [40, true],
        [41, true],
        [42, false],
      ]),
    );
    await expect(service.isEnrollmentWalletConnected(40)).resolves.toBe(true);
    expect(
      connections.findVerifiedEnrollmentIdsByIssuerCode,
    ).toHaveBeenNthCalledWith(1, 'assumption-university', [40, 41, 42]);
    expect(
      connections.findVerifiedEnrollmentIdsByIssuerCode,
    ).toHaveBeenNthCalledWith(2, 'assumption-university', [40]);
  });

  it('returns stable not-found errors for unknown providers and absent connections', async () => {
    const { service } = createService();

    await expect(
      service.getConnection(5, 'unknown-provider'),
    ).rejects.toMatchObject({
      constructor: NotFoundException,
      response: { code: 'ISSUER_NOT_FOUND' },
    });
    await expect(
      service.getConnection(5, 'assumption-university'),
    ).rejects.toMatchObject({
      response: { code: 'ISSUER_VERIFICATION_NOT_FOUND' },
    });
  });
});
