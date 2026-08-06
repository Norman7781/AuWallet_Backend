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
import { IssuerReviewDecision } from './../src/onboarding-verification/issuer-review/dto/review-onboarding-request.dto';
import { IssuerReviewService } from './../src/onboarding-verification/issuer-review/issuer-review.service';

type ControlledVerificationStatus = 'under_review' | 'matched' | 'rejected';

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
  private nextRequestId = 1001;

  submit(holderAccountId: number, dto: CreateOnboardingRequestDto) {
    const latest = this.latestForHolder(holderAccountId);

    if (
      latest?.verificationStatus === 'under_review' ||
      latest?.verificationStatus === 'matched'
    ) {
      throw new ConflictException({
        code: 'ONBOARDING_REQUEST_ACTIVE',
        message: 'An active onboarding request already exists.',
      });
    }

    const hasExactCandidate = dto.admissionNo !== 'NO-MATCH';
    const requestRecord: ControlledRequest = {
      onboardingRequestId: this.nextRequestId++,
      holderAccountId,
      admissionNo: dto.admissionNo,
      dateOfBirth: dto.dateOfBirth,
      verificationStatus: 'under_review',
      matchedEnrollmentId: hasExactCandidate ? holderAccountId + 1000 : null,
      academicStatus: holderAccountId === 13 ? 'alumni' : 'studying',
      reviewedAt: null,
      rejectionReason: null,
      submittedAt: '2026-08-05T12:00:00.000Z',
    };
    this.requests.push(requestRecord);

    return {
      data: this.toStudentResponse(requestRecord),
      message: 'Onboarding request submitted for issuer review.',
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

  list(query: { page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const underReview = this.requests.filter(
      (requestRecord) => requestRecord.verificationStatus === 'under_review',
    );

    return {
      data: underReview.map((requestRecord) =>
        this.toIssuerResponse(requestRecord),
      ),
      message: 'Onboarding review queue loaded.',
      meta: { page, limit, total: underReview.length },
    };
  }

  get(onboardingRequestId: number) {
    const requestRecord = this.requireRequest(onboardingRequestId);

    return {
      data: this.toIssuerResponse(requestRecord),
      message: 'Onboarding request loaded.',
      meta: {},
    };
  }

  decide(
    onboardingRequestId: number,
    _reviewedBy: string,
    dto: { decision: IssuerReviewDecision; rejectionReason?: string },
  ) {
    const requestRecord = this.requireRequest(onboardingRequestId);

    if (requestRecord.verificationStatus !== 'under_review') {
      throw new ConflictException({
        code: 'REVIEW_ALREADY_DECIDED',
        message: 'This onboarding request is no longer under review.',
      });
    }

    if (dto.decision === IssuerReviewDecision.APPROVE) {
      if (requestRecord.matchedEnrollmentId === null) {
        throw new ConflictException({
          code: 'REVIEW_NOT_APPROVABLE',
          message: 'This onboarding request cannot be approved.',
        });
      }

      requestRecord.verificationStatus = 'matched';
      requestRecord.reviewedAt = '2026-08-05T12:30:00.000Z';

      return {
        data: this.toIssuerResponse(requestRecord),
        message: 'Onboarding request approved.',
        meta: {},
      };
    }

    requestRecord.verificationStatus = 'rejected';
    requestRecord.reviewedAt = '2026-08-05T12:30:00.000Z';
    requestRecord.rejectionReason =
      'IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED';

    return {
      data: this.toIssuerResponse(requestRecord),
      message: 'Onboarding request rejected.',
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

  private requireRequest(onboardingRequestId: number) {
    const requestRecord = this.requests.find(
      (candidate) => candidate.onboardingRequestId === onboardingRequestId,
    );

    if (!requestRecord) {
      throw new NotFoundException('Onboarding request was not found');
    }

    return requestRecord;
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

  private toIssuerResponse(requestRecord: ControlledRequest) {
    const hasExactCandidate = requestRecord.matchedEnrollmentId !== null;

    return {
      onboardingRequestId: requestRecord.onboardingRequestId,
      holderAccountId: requestRecord.holderAccountId,
      admissionNo: requestRecord.admissionNo,
      dateOfBirth: requestRecord.dateOfBirth,
      verificationStatus: requestRecord.verificationStatus,
      systemMatch: hasExactCandidate
        ? 'exact_eligible_candidate'
        : 'not_confirmed',
      canApprove:
        hasExactCandidate &&
        requestRecord.verificationStatus === 'under_review',
      academicReview: hasExactCandidate
        ? {
            studentName: 'Synthetic Student',
            admissionNo: requestRecord.admissionNo,
            dateOfBirth: requestRecord.dateOfBirth,
            degreeName: 'Bachelor of Science',
            major: 'Computer Science',
            majorConcentration: null,
            admissionDate: '2023-06-01',
            academicStatus: requestRecord.academicStatus,
            officialGraduationDate:
              requestRecord.academicStatus === 'alumni' ? '2026-05-20' : null,
          }
        : null,
      reviewedAt: requestRecord.reviewedAt,
      rejectionReason: requestRecord.rejectionReason,
      submittedAt: requestRecord.submittedAt,
    };
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
            accountStatus: null,
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
      .overrideProvider(IssuerReviewService)
      .useValue({
        list: (query: { page?: number; limit?: number }) =>
          controlledWorkflow.list(query),
        get: (onboardingRequestId: number) =>
          controlledWorkflow.get(onboardingRequestId),
        decide: (
          onboardingRequestId: number,
          reviewedBy: string,
          dto: { decision: IssuerReviewDecision; rejectionReason?: string },
        ) => controlledWorkflow.decide(onboardingRequestId, reviewedBy, dto),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    await app.init();
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
        accountStatus: null,
      },
      message: 'Request completed successfully.',
      meta: {},
    });
  });

  it('protects the student onboarding endpoints', async () => {
    await request(app.getHttpServer())
      .post('/onboarding-verification/requests')
      .send({})
      .expect(401);

    await request(app.getHttpServer())
      .get('/onboarding-verification/requests/me')
      .expect(401);
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
    ['current student', 'student-role-fixture', 'DEMO-CURRENT', null],
    ['alumnus', 'alumnus-role-fixture', 'DEMO-ALUMNUS', '2026-05-20'],
  ])(
    '%s submits an exact eligible match, issuer sees canApprove, and approval returns matched',
    async (_scenario, studentToken, admissionNo, graduationDate) => {
      await request(app.getHttpServer())
        .post('/onboarding-verification/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          admissionNo,
          dateOfBirth: '2001-02-03',
          passportNumber: '<synthetic-input>',
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            data: {
              onboardingRequestId: 1001,
              verificationStatus: 'under_review',
            },
          });
        });

      await request(app.getHttpServer())
        .get('/issuer/onboarding-requests?page=1&limit=20')
        .set('Authorization', 'Bearer issuer-role-fixture')
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            data: [
              {
                onboardingRequestId: 1001,
                canApprove: true,
                systemMatch: 'exact_eligible_candidate',
                academicReview: {
                  officialGraduationDate: graduationDate,
                },
              },
            ],
          });
        });

      await request(app.getHttpServer())
        .patch('/issuer/onboarding-requests/1001/decision')
        .set('Authorization', 'Bearer issuer-role-fixture')
        .send({ decision: 'approve' })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            data: {
              verificationStatus: 'matched',
              canApprove: false,
            },
          });
        });
    },
  );

  it('returns stable 409 when issuer attempts to approve a mismatch', async () => {
    await request(app.getHttpServer())
      .post('/onboarding-verification/requests')
      .set('Authorization', 'Bearer mismatch-role-fixture')
      .send({
        admissionNo: 'NO-MATCH',
        dateOfBirth: '2001-02-03',
        passportNumber: '<synthetic-input>',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch('/issuer/onboarding-requests/1001/decision')
      .set('Authorization', 'Bearer issuer-role-fixture')
      .send({ decision: 'approve' })
      .expect(409)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: {
            code: 'REVIEW_NOT_APPROVABLE',
            message: 'This onboarding request cannot be approved.',
            details: [],
          },
        });
      });
  });

  it('issuer rejection preserves an exact candidate and corrected resubmission is accepted', async () => {
    await request(app.getHttpServer())
      .post('/onboarding-verification/requests')
      .set('Authorization', 'Bearer correction-role-fixture')
      .send({
        admissionNo: 'DEMO-ORIGINAL',
        dateOfBirth: '2001-02-03',
        passportNumber: '<synthetic-input>',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch('/issuer/onboarding-requests/1001/decision')
      .set('Authorization', 'Bearer issuer-role-fixture')
      .send({
        decision: 'reject',
        rejectionReason: 'IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: {
            verificationStatus: 'rejected',
            systemMatch: 'exact_eligible_candidate',
            canApprove: false,
            academicReview: {
              admissionNo: 'DEMO-ORIGINAL',
            },
          },
        });
      });

    await request(app.getHttpServer())
      .post('/onboarding-verification/requests')
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
            onboardingRequestId: 1002,
            verificationStatus: 'under_review',
          },
        });
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
    'privileged role fixture %s cannot use the student onboarding route',
    async (accessToken) => {
      const response = await request(app.getHttpServer())
        .post('/onboarding-verification/requests')
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
