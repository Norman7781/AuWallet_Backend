import { ConflictException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { IssuerApiAuthGuard } from '../onboarding-verification/issuer-academic/issuer-api-auth.guard';
import { IssuanceRepository } from './Issuance_repo';
import { ProofOfPossessionService } from './proof-of-possession_service';
import { StudentAcademicService } from './student-academic_service';
import { VcIssuanceController } from './Vc_Issuance_controller';
import { VcService } from './Vc_Service';
import { HolderAccountService } from '../auth-holder-account/holder-account/holder-account.service';
import { AccountStatus } from '../auth-holder-account/common/enums/account-status.enum';
import type { AuthenticatedUser } from '../auth-holder-account/common/interfaces/authenticated-user.interface';

jest.mock('./Vc_Service', () => ({
  VcService: class {},
  InvalidHolderKeyError: class extends Error {},
  ISSUER_BASE_URL: 'https://issuer.example',
  ISSUER_DID: 'did:web:issuer.example',
  SIGNING_KEY_ID: 'key-1',
  ACADEMIC_TRANSCRIPT_VCT: 'academic-transcript',
}));
jest.mock('./proof-of-possession_service', () => ({
  ProofOfPossessionService: class {},
}));

describe('VcIssuanceController reissue', () => {
  const credentialId = '123e4567-e89b-42d3-a456-426614174000';
  const issued = { student_id: '6499002', status: 'issued' };
  const repository = {
    findIssuedByCredentialId: jest.fn(),
    findPendingByStudentId: jest.fn(),
    markIssuedCredentialRevoked: jest.fn(),
  };
  const controller = new VcIssuanceController(
    {} as VcService,
    repository as unknown as IssuanceRepository,
    {} as ProofOfPossessionService,
    {} as StudentAcademicService,
    {} as HolderAccountService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('guards the issuer reissue route', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      controller.reissueCredential,
    ) as unknown[];
    expect(guards).toContain(IssuerApiAuthGuard);
  });

  it('guards the issuer revoke route', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      controller.revokeIssuedCredential,
    ) as unknown[];
    expect(guards).toContain(IssuerApiAuthGuard);
  });

  it('revokes an issued credential and returns the holder-matching offer ID', async () => {
    repository.findIssuedByCredentialId.mockResolvedValue({
      ...issued,
      code: 'offer-1',
      credential_id: credentialId,
    });
    repository.markIssuedCredentialRevoked.mockResolvedValue({
      code: 'offer-1',
      credential_id: credentialId,
      status: 'revoked',
    });

    await expect(controller.revokeIssuedCredential(credentialId)).resolves.toEqual({
      credentialId,
      offerId: 'offer-1',
      status: 'revoked',
    });
    expect(repository.markIssuedCredentialRevoked).toHaveBeenCalledWith('offer-1');
  });

  it('does not revoke an unknown or already revoked credential', async () => {
    repository.findIssuedByCredentialId.mockResolvedValue(null);
    await expect(controller.revokeIssuedCredential(credentialId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.markIssuedCredentialRevoked).not.toHaveBeenCalled();
  });

  it('rejects a concurrent status change', async () => {
    repository.findIssuedByCredentialId.mockResolvedValue({
      ...issued,
      code: 'offer-1',
    });
    repository.markIssuedCredentialRevoked.mockResolvedValue(null);
    await expect(controller.revokeIssuedCredential(credentialId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('creates a new pending offer for the issued credential owner', async () => {
    repository.findIssuedByCredentialId.mockResolvedValue(issued);
    repository.findPendingByStudentId.mockResolvedValue(null);
    const createOffer = jest
      .spyOn(
        controller as unknown as {
          createOfferForStudent: (
            studentNumber: string,
            allowAlreadyIssued: boolean,
          ) => Promise<unknown>;
        },
        'createOfferForStudent',
      )
      .mockResolvedValue({ offerId: 'offer-2', status: 'pending' });

    await expect(controller.reissueCredential(credentialId)).resolves.toEqual({
      offerId: 'offer-2',
      status: 'pending',
      previousCredentialId: credentialId,
    });
    expect(createOffer).toHaveBeenCalledWith('6499002', true);
    createOffer.mockRestore();
  });

  it('rejects unknown issued credentials', async () => {
    repository.findIssuedByCredentialId.mockResolvedValue(null);
    await expect(controller.reissueCredential(credentialId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findPendingByStudentId).not.toHaveBeenCalled();
  });

  it('does not create a second offer while one is pending', async () => {
    repository.findIssuedByCredentialId.mockResolvedValue(issued);
    repository.findPendingByStudentId.mockResolvedValue({ code: 'offer-1' });
    await expect(controller.reissueCredential(credentialId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('VcIssuanceController holder credential status', () => {
  it('returns revoked issued credentials but not cancelled pending offers', async () => {
    const findByStudentId = jest.fn().mockResolvedValue([
      {
        code: 'revoked-vc-offer',
        status: 'revoked',
        credential_id: 'credential-1',
        claims: {},
        created_at: '2026-09-24T00:00:00Z',
      },
      {
        code: 'cancelled-pending-offer',
        status: 'revoked',
        credential_id: null,
        claims: {},
        created_at: '2026-09-23T00:00:00Z',
      },
      {
        code: 'legacy-issued-offer',
        status: 'revoked',
        credential_id: null,
        issued_at: '2026-09-22T00:00:00Z',
        claims: {},
        created_at: '2026-09-22T00:00:00Z',
      },
    ]);
    const holderAccountService = {
      getProfileByAuthUserId: jest.fn().mockResolvedValue({
        holderAccountId: 1,
        studentId: '6499002',
        firstName: 'Test',
        lastName: 'Holder',
        accountStatus: AccountStatus.ACTIVE,
        confirmedAt: '2026-09-01T00:00:00Z',
      }),
    };
    const controller = new VcIssuanceController(
      {} as VcService,
      { findByStudentId } as unknown as IssuanceRepository,
      {} as ProofOfPossessionService,
      {} as StudentAcademicService,
      holderAccountService as unknown as HolderAccountService,
    );

    const result = await controller.getMyOffers({
      supabaseAuthId: 'holder-auth-id',
    } as AuthenticatedUser);

    expect(holderAccountService.getProfileByAuthUserId).toHaveBeenCalledWith(
      'holder-auth-id',
    );
    expect(findByStudentId).toHaveBeenCalledWith('6499002');
    expect(result.data).toEqual([
      expect.objectContaining({
        offerId: 'revoked-vc-offer',
        credentialId: 'credential-1',
        status: 'revoked',
      }),
      expect.objectContaining({
        offerId: 'legacy-issued-offer',
        status: 'revoked',
      }),
    ]);
  });
});
