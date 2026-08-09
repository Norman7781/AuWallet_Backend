import { IssuerDashboardService } from './issuer-dashboard.service';

describe('IssuerDashboardService', () => {
  it('returns the exact safe connection-summary envelope', async () => {
    const repository = {
      loadConnectionSummary: jest.fn().mockResolvedValue({
        verifiedConnectionCount: 1,
        recentVerifications: [
          {
            eventType: 'au_connection_verified',
            programCode: 'SYN-VMES-CS',
            major: 'Computer Science',
            verifiedAt: '2026-08-09T09:00:00.000Z',
          },
        ],
      }),
    };
    const service = new IssuerDashboardService(repository as never);

    const result = await service.getConnectionSummary();

    expect(result).toEqual({
      data: {
        verifiedConnectionCount: 1,
        recentVerifications: [
          {
            eventType: 'au_connection_verified',
            programCode: 'SYN-VMES-CS',
            major: 'Computer Science',
            verifiedAt: '2026-08-09T09:00:00.000Z',
          },
        ],
      },
      message: 'Issuer connection summary loaded.',
      meta: {},
    });
    expect(JSON.stringify(result)).not.toMatch(
      /student(Name)?|admission|dateOfBirth|email|passport|hmac|holder(Account)?Id|auth(User)?Id|providerId|connectionId|enrollmentId|transcript/i,
    );
  });
});
