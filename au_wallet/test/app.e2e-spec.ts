import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AccountStatus } from './../src/auth-holder-account/common/enums/account-status.enum';
import { UserRole } from './../src/auth-holder-account/common/enums/role.enum';
import { AuthService } from './../src/auth-holder-account/auth/auth.service';
import { AuthenticatedUserService } from './../src/auth-holder-account/users/authenticated-user.service';
import { AppModule } from './../src/app.module';
import { configureHttpApplication } from './../src/common/http/configure-http-application';
import { CreateOnboardingRequestDto } from './../src/onboarding-verification/onboarding/dto/create-onboarding-request.dto';
import { OnboardingService } from './../src/onboarding-verification/onboarding/onboarding.service';
import { IssuerReviewService } from './../src/onboarding-verification/issuer-review/issuer-review.service';
import { IssuerConnectionService } from './../src/onboarding-verification/issuer-connections/issuer-connection.service';
import { IssuerDashboardService } from './../src/onboarding-verification/issuer-dashboard/issuer-dashboard.service';
import { SupabaseService } from './../src/supabase/supabase.service';

type ControlledVerificationStatus = 'matched' | 'rejected';

interface ControlledRequest {
  onboardingRequestId: number;
  holderAccountId: number;
  admissionNo: string;
  dateOfBirth: string;
  verificationStatus: ControlledVerificationStatus;
  matchedEnrollmentId: number | null;
  academicStatus: 'studying' | 'alumni';
  reviewedAt: string | null;
  rejectionReason: string | null;
  submittedAt: string;
}

class ControlledAuthService {
  register(dto: { personalEmail: string }) {
    if (dto.personalEmail === 'existing@example.test') {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account with this email already exists.',
      });
    }

    throw new Error('Unexpected controlled registration input');
  }

  login(dto: { email: string }) {
    if (dto.email === 'confirmed-empty@example.test') {
      return {
        message: 'Login successful',
        data: {
          accessToken: 'controlled-access-token',
          refreshToken: 'controlled-refresh-token',
          expiresAt: 123456,
          user: {
            authUserId: 'confirmed-empty-user',
            holderAccountId: 12,
            email: dto.email,
            role: UserRole.STUDENT,
            accountStatus: AccountStatus.ACTIVE,
          },
        },
      };
    }

    if (dto.email === 'unconfirmed@example.test') {
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_CONFIRMED',
        message: 'Confirm your email before logging in.',
      });
    }

    if (dto.email === 'disabled@example.test') {
      throw new ForbiddenException({
        code: 'ACCOUNT_DISABLED',
        message: 'This account is disabled.',
      });
    }

    throw new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });
  }

  refresh() {
    throw new UnauthorizedException({
      code: 'REFRESH_TOKEN_INVALID_OR_EXPIRED',
      message: 'The refresh token is invalid or expired.',
    });
  }
}

class ControlledOnboardingWorkflow {
  private readonly requests: ControlledRequest[] = [];
  private readonly verifiedEnrollmentClaims = new Map<string, number>();
  private nextRequestId = 1001;

  submit(holderAccountId: number, dto: CreateOnboardingRequestDto) {
    const latest = this.latestForHolder(holderAccountId);

    if (latest?.verificationStatus === 'matched') {
      throw new ConflictException({
        code: 'ISSUER_CONNECTION_ALREADY_VERIFIED',
        message: 'This issuer connection is already verified.',
      });
    }

    if (dto.admissionNo === 'ACTIVE-ATTEMPT') {
      throw new ConflictException({
        code: 'ISSUER_VERIFICATION_ACTIVE',
        message: 'An active issuer verification already exists.',
      });
    }

    const hasExactEligibleMatch = !['NO-MATCH', 'WITHDRAWN'].includes(
      dto.admissionNo,
    );
    const enrollmentClaimKey = dto.admissionNo;
    const existingClaim = this.verifiedEnrollmentClaims.get(enrollmentClaimKey);
    const verified =
      hasExactEligibleMatch &&
      (existingClaim === undefined || existingClaim === holderAccountId);

    if (verified) {
      this.verifiedEnrollmentClaims.set(enrollmentClaimKey, holderAccountId);
    }

    const requestRecord: ControlledRequest = {
      onboardingRequestId: this.nextRequestId++,
      holderAccountId,
      admissionNo: dto.admissionNo,
      dateOfBirth: dto.dateOfBirth,
      verificationStatus: verified ? 'matched' : 'rejected',
      matchedEnrollmentId: verified ? holderAccountId + 1000 : null,
      academicStatus: holderAccountId === 13 ? 'alumni' : 'studying',
      reviewedAt: null,
      rejectionReason: verified ? null : 'ISSUER_VERIFICATION_NOT_CONFIRMED',
      submittedAt: '2026-08-05T12:00:00.000Z',
    };
    this.requests.push(requestRecord);

    return {
      data: this.toStudentResponse(requestRecord),
      message: verified
        ? 'Issuer connection verified.'
        : 'Issuer verification could not be confirmed.',
      meta: {},
    };
  }

  getMine(holderAccountId: number) {
    const requestRecord = this.latestForHolder(holderAccountId);

    if (!requestRecord) {
      throw new NotFoundException('No onboarding request was found');
    }

    return {
      data: this.toStudentResponse(requestRecord),
      message: 'Onboarding request loaded.',
      meta: {},
    };
  }

  private latestForHolder(holderAccountId: number) {
    for (let index = this.requests.length - 1; index >= 0; index -= 1) {
      if (this.requests[index].holderAccountId === holderAccountId) {
        return this.requests[index];
      }
    }

    return undefined;
  }

  private toStudentResponse(requestRecord: ControlledRequest) {
    return {
      onboardingRequestId: requestRecord.onboardingRequestId,
      verificationStatus: requestRecord.verificationStatus,
      rejectionReason: requestRecord.rejectionReason,
      reviewedAt: requestRecord.reviewedAt,
      submittedAt: requestRecord.submittedAt,
    };
  }

  listProviders(holderAccountId: number) {
    const current = this.latestForHolder(holderAccountId);
    const connectionStatus = current
      ? this.connectionStatus(current.verificationStatus)
      : null;

    return {
      data: [
        {
          issuerCode: 'assumption-university',
          displayName: 'Assumption University',
          description: 'Prototype provider',
          availability: 'available',
          connectionEnabled: true,
          isMock: true,
          connectionStatus,
        },
        {
          issuerCode: 'demo-issuer-alpha',
          displayName: 'Demo Issuer Alpha',
          description: 'Synthetic placeholder',
          availability: 'coming_soon',
          connectionEnabled: false,
          isMock: true,
          connectionStatus: null,
        },
        {
          issuerCode: 'demo-issuer-beta',
          displayName: 'Demo Issuer Beta',
          description: 'Synthetic placeholder',
          availability: 'coming_soon',
          connectionEnabled: false,
          isMock: true,
          connectionStatus: null,
        },
      ],
      message: 'Issuer providers loaded.',
      meta: {},
    };
  }

  listConnections(holderAccountId: number) {
    const latest = this.latestForHolder(holderAccountId);

    return {
      data: latest ? [this.toConnectionResponse(latest)] : [],
      message: 'Issuer connections loaded.',
      meta: {},
    };
  }

  getConnection(holderAccountId: number, issuerCode: string) {
    if (issuerCode !== 'assumption-university') {
      throw new NotFoundException({
        code: 'ISSUER_NOT_FOUND',
        message: 'The issuer provider was not found.',
      });
    }

    const latest = this.latestForHolder(holderAccountId);

    if (!latest) {
      throw new NotFoundException({
        code: 'ISSUER_VERIFICATION_NOT_FOUND',
        message: 'No issuer connection was found.',
      });
    }

    return {
      data: this.toConnectionResponse(latest),
      message: 'Issuer connection loaded.',
      meta: {},
    };
  }

  submitVerification(
    holderAccountId: number,
    issuerCode: string,
    dto: CreateOnboardingRequestDto,
  ) {
    if (
      issuerCode === 'demo-issuer-alpha' ||
      issuerCode === 'demo-issuer-beta'
    ) {
      throw new ConflictException({
        code: 'ISSUER_CONNECTION_NOT_AVAILABLE',
        message: 'Issuer connection verification is not available.',
      });
    }

    if (issuerCode !== 'assumption-university') {
      throw new NotFoundException({
        code: 'ISSUER_NOT_FOUND',
        message: 'The issuer provider was not found.',
      });
    }

    const submitted = this.submit(holderAccountId, dto);
    const latest = this.latestForHolder(holderAccountId)!;

    return {
      data: this.toConnectionResponse(latest),
      message: submitted.message,
      meta: {},
    };
  }

  private toConnectionResponse(requestRecord: ControlledRequest) {
    return {
      issuerCode: 'assumption-university',
      displayName: 'Assumption University',
      connectionStatus: this.connectionStatus(requestRecord.verificationStatus),
      latestVerificationStatus: requestRecord.verificationStatus,
      rejectionReason: requestRecord.rejectionReason,
      submittedAt: requestRecord.submittedAt,
      reviewedAt: requestRecord.reviewedAt,
      verifiedAt:
        requestRecord.verificationStatus === 'matched'
          ? requestRecord.reviewedAt
          : null,
    };
  }

  private connectionStatus(status: ControlledVerificationStatus) {
    if (status === 'matched') return 'verified';
    if (status === 'rejected') return 'rejected';
    return 'rejected';
  }
}

describe('AU Wallet backend API (e2e)', () => {
  let app: INestApplication<App>;
  let controlledWorkflow: ControlledOnboardingWorkflow;

  beforeEach(async () => {
    controlledWorkflow = new ControlledOnboardingWorkflow();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(new ControlledAuthService())
      .overrideProvider(AuthenticatedUserService)
      .useValue({
        identify: jest.fn((accessToken: string) => {
          const studentHolderIds: Record<string, number> = {
            'student-role-fixture': 12,
            'alumnus-role-fixture': 13,
            'mismatch-role-fixture': 14,
            'correction-role-fixture': 15,
            'withdrawn-role-fixture': 16,
            'pending-role-fixture': 17,
            'graduate-role-fixture': 18,
            'duplicate-claim-role-fixture': 19,
            'concurrent-claim-role-fixture': 20,
          };
          const studentHolderId = studentHolderIds[accessToken];
          const role =
            accessToken === 'issuer-role-fixture'
              ? UserRole.ISSUER_STAFF
              : accessToken === 'admin-role-fixture'
                ? UserRole.ADMIN
                : studentHolderId
                  ? UserRole.STUDENT
                  : null;

          if (!role) {
            throw new UnauthorizedException({
              code: 'ACCESS_TOKEN_INVALID_OR_EXPIRED',
              message: 'The access token is missing, invalid, or expired.',
            });
          }

          return {
            supabaseAuthId:
              accessToken === 'student-role-fixture'
                ? 'student-fixture-id'
                : `${accessToken}-id`,
            holderAccountId: studentHolderId ?? null,
            email: `${accessToken}@example.test`,
            role,
            accountStatus:
              accessToken === 'pending-role-fixture'
                ? AccountStatus.PENDING
                : studentHolderId
                  ? AccountStatus.ACTIVE
                  : null,
          };
        }),
      })
      .overrideProvider(OnboardingService)
      .useValue({
        submit: (holderAccountId: number, dto: CreateOnboardingRequestDto) =>
          controlledWorkflow.submit(holderAccountId, dto),
        getMine: (holderAccountId: number) =>
          controlledWorkflow.getMine(holderAccountId),
      })
      .overrideProvider(IssuerConnectionService)
      .useValue({
        listProviders: (holderAccountId: number) =>
          controlledWorkflow.listProviders(holderAccountId),
        listConnections: (holderAccountId: number) =>
          controlledWorkflow.listConnections(holderAccountId),
        getConnection: (holderAccountId: number, issuerCode: string) =>
          controlledWorkflow.getConnection(holderAccountId, issuerCode),
        submitVerification: (
          holderAccountId: number,
          issuerCode: string,
          dto: CreateOnboardingRequestDto,
        ) =>
          controlledWorkflow.submitVerification(
            holderAccountId,
            issuerCode,
            dto,
          ),
      })
      .overrideProvider(IssuerReviewService)
      .useValue({
        list: jest.fn(),
        get: jest.fn(),
        decide: jest.fn(),
      })
      .overrideProvider(IssuerDashboardService)
      .useValue({
        getConnectionSummary: jest.fn().mockResolvedValue({
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
        }),
      })
      .overrideProvider(SupabaseService)
      .useValue({
        schema: jest.fn(() => {
          throw new Error('Controlled E2E must not contact live Supabase');
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    await app.init();
  });

  it('returns the exact safe health envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      data: { status: 'ok' },
      message: 'Service is healthy.',
      meta: {},
    });
    const healthBody = response.body as unknown as { data: object };
    expect(Object.keys(healthBody.data)).toEqual(['status']);
  });

  it('loads the temporary dashboard summary without issuer login in test', async () => {
    const response = await request(app.getHttpServer())
      .get('/issuer/dashboard/connection-summary')
      .expect(200);

    expect(response.body).toEqual({
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
    expect(JSON.stringify(response.body)).not.toMatch(
      /student(Name)?|admission|dateOfBirth|email|passport|hmac|holder(Account)?Id|auth(User)?Id|providerId|connectionId|enrollmentId|transcript/i,
    );
  });

  it('keeps student provider APIs authenticated', async () => {
    await request(app.getHttpServer()).get('/issuer-providers').expect(401);
    await request(app.getHttpServer())
      .get('/issuer-connections/me')
      .expect(401);
  });

  it('does not introduce Member 3 transcript functionality', async () => {
    await request(app.getHttpServer()).get('/issuer/transcripts').expect(404);
    await request(app.getHttpServer())
      .post('/issuer/transcripts')
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .get('/issuer/dashboard/transcript-analytics')
      .expect(404);
  });

  it('rejects an invalid registration body', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        personalEmail: 'not-an-email',
        password: 'weak',
        unexpected: true,
      })
      .expect(400);

    expect(response.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
      },
    });
    const validationBody = response.body as {
      error: { details: unknown };
    };
    expect(Array.isArray(validationBody.error.details)).toBe(true);
  });

  it('returns EMAIL_ALREADY_REGISTERED for an existing registration email', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        firstName: 'Synthetic',
        lastName: 'Student',
        personalEmail: 'existing@example.test',
        password: 'Password1',
      })
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account with this email already exists.',
        details: [],
      },
    });
  });

  it('returns EMAIL_NOT_CONFIRMED for login before confirmation', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'unconfirmed@example.test', password: 'Password1' })
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: 'EMAIL_NOT_CONFIRMED',
        message: 'Confirm your email before logging in.',
        details: [],
      },
    });
  });

  it('returns INVALID_CREDENTIALS without revealing whether an email exists', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'unknown@example.test', password: 'Password1' })
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
        details: [],
      },
    });
  });

  it('returns REFRESH_TOKEN_INVALID_OR_EXPIRED for an unusable refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'unusable-refresh-token' })
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: 'REFRESH_TOKEN_INVALID_OR_EXPIRED',
        message: 'The refresh token is invalid or expired.',
        details: [],
      },
    });
  });

  it('returns ACCOUNT_DISABLED for a disabled holder login', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'disabled@example.test', password: 'Password1' })
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'This account is disabled.',
        details: [],
      },
    });
  });

  it('lets a confirmed student enter an active empty wallet without AU verification', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'confirmed-empty@example.test', password: 'Password1' })
      .expect(201);

    expect(login.body).toMatchObject({
      data: { user: { accountStatus: AccountStatus.ACTIVE } },
    });

    const connections = await request(app.getHttpServer())
      .get('/issuer-connections/me')
      .set('Authorization', 'Bearer student-role-fixture')
      .expect(200);

    const connectionBody = connections.body as unknown as { data: unknown[] };
    expect(connectionBody.data).toEqual([]);
  });

  it('protects the current-user endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: 'ACCESS_TOKEN_INVALID_OR_EXPIRED',
        message: 'The access token is missing, invalid, or expired.',
        details: [],
      },
    });
  });

  it('returns ACCESS_TOKEN_INVALID_OR_EXPIRED for an invalid Bearer token', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: 'ACCESS_TOKEN_INVALID_OR_EXPIRED',
        message: 'The access token is missing, invalid, or expired.',
        details: [],
      },
    });
  });

  it('wraps successful responses in the shared success envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer student-role-fixture')
      .expect(200);

    expect(response.body).toEqual({
      data: {
        supabaseAuthId: 'student-fixture-id',
        holderAccountId: 12,
        email: 'student-role-fixture@example.test',
        role: 'student',
        accountStatus: AccountStatus.ACTIVE,
      },
      message: 'Request completed successfully.',
      meta: {},
    });
  });

  it('does not expose the superseded wallet-onboarding endpoints', async () => {
    await request(app.getHttpServer())
      .post('/onboarding-verification/requests')
      .set('Authorization', 'Bearer student-role-fixture')
      .send({})
      .expect(404);

    await request(app.getHttpServer())
      .get('/onboarding-verification/requests/me')
      .set('Authorization', 'Bearer student-role-fixture')
      .expect(404);
  });

  it('protects the issuer review endpoints', async () => {
    await request(app.getHttpServer())
      .get('/issuer/onboarding-requests')
      .expect(401);

    await request(app.getHttpServer())
      .get('/issuer/onboarding-requests/1')
      .expect(401);

    await request(app.getHttpServer())
      .patch('/issuer/onboarding-requests/1/decision')
      .send({})
      .expect(401);
  });

  it('returns exactly three provider fixtures and only AU is available', async () => {
    const response = await request(app.getHttpServer())
      .get('/issuer-providers')
      .set('Authorization', 'Bearer student-role-fixture')
      .expect(200);

    const providerBody = response.body as unknown as {
      data: Array<{ connectionEnabled: boolean }>;
    };

    expect(providerBody.data).toHaveLength(3);
    expect(
      providerBody.data.filter((provider) => provider.connectionEnabled),
    ).toEqual([
      expect.objectContaining({
        issuerCode: 'assumption-university',
        availability: 'available',
        isMock: true,
      }),
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(
      /issuerProviderId|holderIssuerConnectionId/i,
    );
  });

  it.each(['demo-issuer-alpha', 'demo-issuer-beta'])(
    'rejects unavailable provider verification for %s',
    async (issuerCode) => {
      const response = await request(app.getHttpServer())
        .post(`/issuer-connections/${issuerCode}/verification-requests`)
        .set('Authorization', 'Bearer student-role-fixture')
        .send({
          admissionNo: 'SYNTHETIC-ID',
          dateOfBirth: '2001-02-03',
          passportNumber: '<synthetic-input>',
        })
        .expect(409);

      expect(response.body).toMatchObject({
        error: { code: 'ISSUER_CONNECTION_NOT_AVAILABLE' },
      });
    },
  );

  it.each([
    ['current student', 'student-role-fixture', 'DEMO-CURRENT'],
    ['graduate', 'graduate-role-fixture', 'DEMO-GRADUATE'],
    ['alumnus', 'alumnus-role-fixture', 'DEMO-ALUMNUS'],
  ])(
    'automatically verifies an exact eligible %s AU connection',
    async (_scenario, studentToken, admissionNo) => {
      const submitted = await request(app.getHttpServer())
        .post('/issuer-connections/assumption-university/verification-requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          admissionNo,
          dateOfBirth: '2001-02-03',
          passportNumber: '<synthetic-input>',
        })
        .expect(201);

      expect(submitted.body).toMatchObject({
        data: {
          issuerCode: 'assumption-university',
          connectionStatus: 'verified',
          latestVerificationStatus: 'matched',
          reviewedAt: null,
        },
      });
      expect(JSON.stringify(submitted.body)).not.toMatch(
        /passport|hmac|enrollmentId|issuerProviderId|holderIssuerConnectionId|verificationRequestId/i,
      );

      const verified = await request(app.getHttpServer())
        .get('/issuer-connections/assumption-university')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(verified.body).toMatchObject({
        data: {
          connectionStatus: 'verified',
          latestVerificationStatus: 'matched',
        },
      });
      const verifiedBody = verified.body as unknown as {
        data: Record<string, unknown>;
      };
      expect(verifiedBody.data).not.toHaveProperty('accountStatus');
    },
  );

  it('AU verification does not change the independent holder account state', async () => {
    const submitted = await request(app.getHttpServer())
      .post('/issuer-connections/assumption-university/verification-requests')
      .set('Authorization', 'Bearer student-role-fixture')
      .send({
        admissionNo: 'DEMO-CURRENT',
        dateOfBirth: '2001-02-03',
        passportNumber: '<synthetic-input>',
      })
      .expect(201);

    expect(submitted.body).toMatchObject({
      data: {
        issuerCode: 'assumption-university',
        connectionStatus: 'verified',
        latestVerificationStatus: 'matched',
      },
    });

    const holder = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer student-role-fixture')
      .expect(200);

    expect(holder.body).toMatchObject({
      data: { accountStatus: AccountStatus.ACTIVE },
    });
  });

  it('returns issuer-verification not found before a connection exists', async () => {
    const response = await request(app.getHttpServer())
      .get('/issuer-connections/assumption-university')
      .set('Authorization', 'Bearer student-role-fixture')
      .expect(404);

    expect(response.body).toMatchObject({
      error: { code: 'ISSUER_VERIFICATION_NOT_FOUND' },
    });
  });

  it.each(['issuer-role-fixture', 'admin-role-fixture'])(
    'prevents privileged role fixture %s from directly activating a holder',
    async (accessToken) => {
      const response = await request(app.getHttpServer())
        .patch('/holder-accounts/12/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ accountStatus: AccountStatus.ACTIVE })
        .expect(400);

      expect(response.body).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      });
    },
  );

  it.each([
    ['missing or ambiguous', 'mismatch-role-fixture', 'NO-MATCH'],
    ['withdrawn or ineligible', 'withdrawn-role-fixture', 'WITHDRAWN'],
  ])(
    'returns one generic rejected result for %s identity',
    async (_case, token, admissionNo) => {
      const response = await request(app.getHttpServer())
        .post('/issuer-connections/assumption-university/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          admissionNo,
          dateOfBirth: '2001-02-03',
          passportNumber: '<synthetic-input>',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        data: {
          connectionStatus: 'rejected',
          latestVerificationStatus: 'rejected',
          rejectionReason: 'ISSUER_VERIFICATION_NOT_CONFIRMED',
        },
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /NO-MATCH|WITHDRAWN|passport|hmac|enrollmentId/i,
      );
    },
  );

  it('accepts corrected resubmission after a generic rejection', async () => {
    await request(app.getHttpServer())
      .post('/issuer-connections/assumption-university/verification-requests')
      .set('Authorization', 'Bearer correction-role-fixture')
      .send({
        admissionNo: 'NO-MATCH',
        dateOfBirth: '2001-02-03',
        passportNumber: '<synthetic-input>',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/issuer-connections/assumption-university/verification-requests')
      .set('Authorization', 'Bearer correction-role-fixture')
      .send({
        admissionNo: 'DEMO-CORRECTED',
        dateOfBirth: '2001-02-03',
        passportNumber: '<corrected-synthetic-input>',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: {
            connectionStatus: 'verified',
            latestVerificationStatus: 'matched',
          },
        });
      });
  });

  it('rejects duplicate verification after the AU connection is verified', async () => {
    const body = {
      admissionNo: 'DEMO-CURRENT',
      dateOfBirth: '2001-02-03',
      passportNumber: '<synthetic-input>',
    };

    await request(app.getHttpServer())
      .post('/issuer-connections/assumption-university/verification-requests')
      .set('Authorization', 'Bearer student-role-fixture')
      .send(body)
      .expect(201);

    await request(app.getHttpServer())
      .post('/issuer-connections/assumption-university/verification-requests')
      .set('Authorization', 'Bearer student-role-fixture')
      .send(body)
      .expect(409)
      .expect(({ body: responseBody }) => {
        expect(responseBody).toMatchObject({
          error: { code: 'ISSUER_CONNECTION_ALREADY_VERIFIED' },
        });
      });
  });

  it('generically rejects a sequential claim of an AU enrollment verified by another holder', async () => {
    const body = {
      admissionNo: 'DEMO-CURRENT',
      dateOfBirth: '2001-02-03',
      passportNumber: '<synthetic-input>',
    };

    await request(app.getHttpServer())
      .post('/issuer-connections/assumption-university/verification-requests')
      .set('Authorization', 'Bearer student-role-fixture')
      .send(body)
      .expect(201)
      .expect(({ body: responseBody }) => {
        expect(responseBody).toMatchObject({
          data: {
            connectionStatus: 'verified',
            latestVerificationStatus: 'matched',
          },
        });
      });

    const duplicate = await request(app.getHttpServer())
      .post('/issuer-connections/assumption-university/verification-requests')
      .set('Authorization', 'Bearer duplicate-claim-role-fixture')
      .send(body)
      .expect(201);

    expect(duplicate.body).toMatchObject({
      data: {
        connectionStatus: 'rejected',
        latestVerificationStatus: 'rejected',
        rejectionReason: 'ISSUER_VERIFICATION_NOT_CONFIRMED',
      },
    });
    expect(JSON.stringify(duplicate.body)).not.toMatch(
      /passport|hmac|enrollmentId|holderId|already linked|duplicate claim/i,
    );

    await request(app.getHttpServer())
      .post('/issuer-connections/assumption-university/verification-requests')
      .set('Authorization', 'Bearer duplicate-claim-role-fixture')
      .send({
        ...body,
        admissionNo: 'DEMO-UNIQUE-CORRECTION',
      })
      .expect(201)
      .expect(({ body: correctedBody }) => {
        expect(correctedBody).toMatchObject({
          data: {
            connectionStatus: 'verified',
            latestVerificationStatus: 'matched',
          },
        });
      });
  });

  it('allows only one of two concurrent holders to verify the same AU enrollment', async () => {
    const body = {
      admissionNo: 'DEMO-SHARED-CLAIM',
      dateOfBirth: '2001-02-03',
      passportNumber: '<synthetic-input>',
    };

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/issuer-connections/assumption-university/verification-requests')
        .set('Authorization', 'Bearer duplicate-claim-role-fixture')
        .send(body)
        .expect(201),
      request(app.getHttpServer())
        .post('/issuer-connections/assumption-university/verification-requests')
        .set('Authorization', 'Bearer concurrent-claim-role-fixture')
        .send(body)
        .expect(201),
    ]);

    const statuses = responses.map(
      (response) =>
        (response.body as { data: { connectionStatus: string } }).data
          .connectionStatus,
    );
    expect(statuses.filter((status) => status === 'verified')).toHaveLength(1);
    expect(statuses.filter((status) => status === 'rejected')).toHaveLength(1);
    const safeBodies: unknown[] = responses.map(
      (response) => response.body as unknown,
    );
    expect(JSON.stringify(safeBodies)).not.toMatch(
      /passport|hmac|enrollmentId|holderId|already linked|duplicate claim/i,
    );
  });

  it('requires an active holder for provider-connection routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/issuer-providers')
      .set('Authorization', 'Bearer pending-role-fixture')
      .expect(403);

    expect(response.body).toMatchObject({
      error: { code: 'ACCOUNT_DISABLED' },
    });
  });

  it('student cannot use issuer routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/issuer/onboarding-requests')
      .set('Authorization', 'Bearer student-role-fixture')
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission for this action.',
        details: [],
      },
    });
  });

  it.each(['issuer-role-fixture', 'admin-role-fixture'])(
    'privileged role fixture %s cannot use the wallet provider route',
    async (accessToken) => {
      const response = await request(app.getHttpServer())
        .post('/issuer-connections/assumption-university/verification-requests')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(403);

      expect(response.body).toMatchObject({ error: { code: 'FORBIDDEN' } });
    },
  );

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
