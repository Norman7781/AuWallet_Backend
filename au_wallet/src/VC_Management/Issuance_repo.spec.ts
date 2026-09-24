import type { SupabaseService } from '../supabase/supabase.service';
import type { AcademicTranscriptClaims } from './Academic_tran_type';
import { IssuanceRepository } from './Issuance_repo';

function createUpdateBuilder(response: { data: unknown; error: unknown }) {
  const builder = {
    update: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    gt: jest.fn(),
    select: jest.fn(),
    maybeSingle: jest.fn(),
  };

  for (const method of [
    builder.update,
    builder.eq,
    builder.is,
    builder.gt,
    builder.select,
  ]) {
    method.mockReturnValue(builder);
  }
  builder.maybeSingle.mockResolvedValue(response);
  return builder;
}

describe('IssuanceRepository direct-offer nonce lifecycle', () => {
  const activeOffer = {
    code: 'offer-1',
    student_id: '6499002',
    c_nonce: 'nonce-1',
    c_nonce_expires_at: '2099-01-01T00:00:00.000Z',
    c_nonce_consumed_at: null,
    c_nonce_holder_account_id: 12,
  };

  it('keeps an active nonce bound to the same holder without writing', async () => {
    const from = jest.fn();
    const repository = new IssuanceRepository({
      client: { from },
    } as unknown as SupabaseService);

    await expect(
      repository.ensureActiveDirectOfferNonce(
        activeOffer,
        12,
        'replacement-nonce',
        '2099-01-01T00:05:00.000Z',
      ),
    ).resolves.toBe(activeOffer);
    expect(from).not.toHaveBeenCalled();
  });

  it('rotates an expired nonce and binds the replacement to the holder', async () => {
    const builder = createUpdateBuilder({
      data: { ...activeOffer, c_nonce: 'replacement-nonce' },
      error: null,
    });
    const from = jest.fn().mockReturnValue(builder);
    const repository = new IssuanceRepository({
      client: { from },
    } as unknown as SupabaseService);

    await expect(
      repository.ensureActiveDirectOfferNonce(
        {
          ...activeOffer,
          c_nonce_expires_at: '2000-01-01T00:00:00.000Z',
        },
        12,
        'replacement-nonce',
        '2099-01-01T00:05:00.000Z',
      ),
    ).resolves.toMatchObject({ c_nonce: 'replacement-nonce' });

    expect(from).toHaveBeenCalledWith('vc_issuance_log');
    expect(builder.update).toHaveBeenCalledWith({
      c_nonce: 'replacement-nonce',
      c_nonce_expires_at: '2099-01-01T00:05:00.000Z',
      c_nonce_consumed_at: null,
      c_nonce_holder_account_id: 12,
    });
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('requires the exact bound nonce before recording issuance', async () => {
    const builder = createUpdateBuilder({ data: { code: 'offer-1' }, error: null });
    const from = jest.fn().mockReturnValue(builder);
    const repository = new IssuanceRepository({
      client: { from },
    } as unknown as SupabaseService);

    await repository.markIssuedFromAccept(
      'offer-1',
      '6499002',
      12,
      'nonce-1',
      'credential-1',
    );

    expect(builder.eq).toHaveBeenCalledWith('c_nonce', 'nonce-1');
    expect(builder.eq).toHaveBeenCalledWith('c_nonce_holder_account_id', 12);
    expect(builder.is).toHaveBeenCalledWith('c_nonce_consumed_at', null);
    expect(builder.gt).toHaveBeenCalledWith(
      'c_nonce_expires_at',
      expect.any(String),
    );
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'issued',
        credential_id: 'credential-1',
        issued_at: expect.any(String),
        accepted_at: expect.any(String),
        c_nonce_consumed_at: expect.any(String),
      }),
    );
  });
});

describe('IssuanceRepository reissue offers', () => {
  const claims = {
    student: { identifier: { value: '6499002' } },
  } as unknown as AcademicTranscriptClaims;

  it('still blocks ordinary duplicate issuance', async () => {
    const lookup = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { status: 'issued' },
        error: null,
      }),
    };
    lookup.select.mockReturnValue(lookup);
    lookup.eq.mockReturnValue(lookup);
    const from = jest.fn().mockReturnValue(lookup);
    const repository = new IssuanceRepository({
      client: { from },
    } as unknown as SupabaseService);

    await expect(
      repository.savePendingOffer(claims, 'new-code', 'nonce', 'expiry', 'hash'),
    ).rejects.toThrow('Academic transcript already issued');
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('creates a new pending offer for an explicit reissue', async () => {
    const revoke = {
      update: jest.fn(),
      eq: jest.fn(),
      then: (resolve: (value: { error: null }) => void) =>
        resolve({ error: null }),
    };
    revoke.update.mockReturnValue(revoke);
    revoke.eq.mockReturnValue(revoke);
    const insert = {
      insert: jest.fn(),
      select: jest.fn(),
      single: jest.fn().mockResolvedValue({
        data: { code: 'new-code', status: 'pending' },
        error: null,
      }),
    };
    insert.insert.mockReturnValue(insert);
    insert.select.mockReturnValue(insert);
    const from = jest.fn().mockReturnValueOnce(revoke).mockReturnValueOnce(insert);
    const repository = new IssuanceRepository({
      client: { from },
    } as unknown as SupabaseService);

    await expect(
      repository.savePendingOffer(
        claims,
        'new-code',
        'nonce',
        'expiry',
        'hash',
        true,
      ),
    ).resolves.toEqual({ code: 'new-code', status: 'pending' });
    expect(from).toHaveBeenCalledTimes(2);
    expect(revoke.eq).toHaveBeenCalledWith('status', 'pending');
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: '6499002', status: 'pending' }),
    );
  });

  it('finds an issued row by its legacy offer code when needed', async () => {
    const lookup = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest
        .fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { code: 'old-code', student_id: '6499002' },
          error: null,
        }),
    };
    lookup.select.mockReturnValue(lookup);
    lookup.eq.mockReturnValue(lookup);
    const repository = new IssuanceRepository({
      client: { from: jest.fn().mockReturnValue(lookup) },
    } as unknown as SupabaseService);

    await expect(repository.findIssuedByCredentialId('old-code')).resolves.toEqual({
      code: 'old-code',
      student_id: '6499002',
    });
    expect(lookup.eq).toHaveBeenCalledWith('credential_id', 'old-code');
    expect(lookup.eq).toHaveBeenCalledWith('code', 'old-code');
    expect(lookup.eq).toHaveBeenCalledWith('status', 'issued');
  });
});

describe('IssuanceRepository issued credential revocation', () => {
  it('only transitions an issued row to revoked', async () => {
    const builder = createUpdateBuilder({
      data: { code: 'offer-1', credential_id: 'credential-1', status: 'revoked' },
      error: null,
    });
    const repository = new IssuanceRepository({
      client: { from: jest.fn().mockReturnValue(builder) },
    } as unknown as SupabaseService);

    await expect(repository.markIssuedCredentialRevoked('offer-1')).resolves.toMatchObject({
      status: 'revoked',
    });
    expect(builder.update).toHaveBeenCalledWith({ status: 'revoked' });
    expect(builder.eq).toHaveBeenCalledWith('code', 'offer-1');
    expect(builder.eq).toHaveBeenCalledWith('status', 'issued');
  });
});
