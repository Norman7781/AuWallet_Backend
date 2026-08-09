import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { HolderIssuerConnectionRepository } from './holder-issuer-connection.repository';

const input = {
  holderAccountId: 5,
  issuerCode: 'assumption-university',
  admissionNo: 'SYNTHETIC-ID',
  dateOfBirth: '2000-01-01',
  passportNumberHmac: 'a'.repeat(64),
};

function createRepository(result: unknown) {
  const single = jest.fn().mockResolvedValue(result);
  const rpc = jest.fn().mockReturnValue({ single });
  const schema = jest.fn().mockReturnValue({ rpc });
  const repository = new HolderIssuerConnectionRepository({ schema } as never);

  return { repository, schema, rpc };
}

describe('HolderIssuerConnectionRepository automatic verification', () => {
  it('maps the backend-only RPC response without internal IDs', async () => {
    const { repository, rpc } = createRepository({
      data: {
        issuer_code: 'assumption-university',
        connection_status: 'verified',
        verification_status: 'matched',
        rejection_reason: null,
        submitted_at: '2026-08-09T01:00:00.000Z',
        reviewed_at: null,
        verified_at: '2026-08-09T01:00:00.000Z',
      },
      error: null,
    });

    const result = await repository.submitVerification(input);

    expect(rpc).toHaveBeenCalledWith(
      'submit_issuer_connection_verification',
      expect.objectContaining({
        p_holder_account_id: 5,
        p_issuer_code: 'assumption-university',
      }),
    );
    expect(result).toEqual({
      issuerCode: 'assumption-university',
      connectionStatus: 'verified',
      verificationStatus: 'matched',
      rejectionReason: null,
      submittedAt: '2026-08-09T01:00:00.000Z',
      reviewedAt: null,
      verifiedAt: '2026-08-09T01:00:00.000Z',
    });
    expect(JSON.stringify(result)).not.toMatch(
      /holderAccountId|connectionId|requestId|enrollmentId|passport|hmac/i,
    );
  });

  it('treats a duplicate enrollment claim as the same safe unsuccessful result', async () => {
    const { repository } = createRepository({
      data: {
        issuer_code: 'assumption-university',
        connection_status: 'rejected',
        verification_status: 'rejected',
        rejection_reason: 'ISSUER_VERIFICATION_NOT_CONFIRMED',
        submitted_at: '2026-08-09T01:00:00.000Z',
        reviewed_at: null,
        verified_at: null,
      },
      error: null,
    });

    const result = await repository.submitVerification(input);

    expect(result).toEqual({
      issuerCode: 'assumption-university',
      connectionStatus: 'rejected',
      verificationStatus: 'rejected',
      rejectionReason: 'ISSUER_VERIFICATION_NOT_CONFIRMED',
      submittedAt: '2026-08-09T01:00:00.000Z',
      reviewedAt: null,
      verifiedAt: null,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /holderId|enrollmentId|already linked|duplicate claim|passport|hmac/i,
    );
  });

  it.each([
    ['P1001', NotFoundException, 'ISSUER_NOT_FOUND'],
    ['P1002', ConflictException, 'ISSUER_CONNECTION_NOT_AVAILABLE'],
    ['P1003', ConflictException, 'ISSUER_CONNECTION_ALREADY_VERIFIED'],
    ['P1004', ConflictException, 'ISSUER_VERIFICATION_ACTIVE'],
    ['P1005', ForbiddenException, 'ACCOUNT_DISABLED'],
  ])(
    'maps SQLSTATE %s to a stable safe error',
    async (code, type, stableCode) => {
      const { repository } = createRepository({
        data: null,
        error: { code, message: 'database detail that must stay private' },
      });

      await expect(repository.submitVerification(input)).rejects.toMatchObject({
        constructor: type,
        response: { code: stableCode },
      });
    },
  );

  it('hides unexpected database errors', async () => {
    const { repository } = createRepository({
      data: null,
      error: { code: 'XX000', message: 'private database detail' },
    });

    await expect(repository.submitVerification(input)).rejects.toEqual(
      new InternalServerErrorException(
        'Unable to verify the issuer connection',
      ),
    );
  });
});
