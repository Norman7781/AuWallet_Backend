import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

function createHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('ApiExceptionFilter', () => {
  const cases = [
    [
      new UnauthorizedException('unsafe detail'),
      401,
      'AUTHENTICATION_REQUIRED',
      'Authentication is required.',
    ],
    [
      new ForbiddenException('unsafe detail'),
      403,
      'FORBIDDEN',
      'You do not have permission for this action.',
    ],
    [
      new NotFoundException('unsafe detail'),
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    ],
    [
      new ConflictException('unsafe detail'),
      409,
      'CONFLICT',
      'The request conflicts with the current state.',
    ],
    [
      new InternalServerErrorException('unsafe SQL detail'),
      500,
      'INTERNAL_ERROR',
      'An internal error occurred.',
    ],
    [
      new Error('unsafe internal detail'),
      500,
      'INTERNAL_ERROR',
      'An internal error occurred.',
    ],
  ] as const;

  it.each(cases)(
    'returns a stable safe envelope for %p',
    (exception, expectedStatus, expectedCode, expectedMessage) => {
      const { host, status, json } = createHost();

      new ApiExceptionFilter().catch(exception, host);

      expect(status).toHaveBeenCalledWith(expectedStatus);
      expect(json).toHaveBeenCalledWith({
        error: {
          code: expectedCode,
          message: expectedMessage,
          details: [],
        },
      });
    },
  );

  it('returns validation details without changing their safe field messages', () => {
    const { host, json } = createHost();
    const exception = new BadRequestException({
      message: ['admissionNo must be a string'],
    });

    new ApiExceptionFilter().catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: ['admissionNo must be a string'],
      },
    });
  });

  it('preserves a stable service code and its controlled message', () => {
    const { host, json } = createHost();
    const exception = new ConflictException({
      code: 'REVIEW_NOT_APPROVABLE',
      message: 'This onboarding request cannot be approved.',
    });

    new ApiExceptionFilter().catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'REVIEW_NOT_APPROVABLE',
        message: 'This onboarding request cannot be approved.',
        details: [],
      },
    });
  });

  it.each([
    [
      'EMAIL_NOT_CONFIRMED',
      new UnauthorizedException({
        code: 'EMAIL_NOT_CONFIRMED',
        message: 'Confirm your email before logging in.',
      }),
      401,
      'Confirm your email before logging in.',
    ],
    [
      'INVALID_CREDENTIALS',
      new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      }),
      401,
      'Invalid email or password.',
    ],
    [
      'EMAIL_ALREADY_REGISTERED',
      new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account with this email already exists.',
      }),
      409,
      'An account with this email already exists.',
    ],
    [
      'ACCESS_TOKEN_INVALID_OR_EXPIRED',
      new UnauthorizedException({
        code: 'ACCESS_TOKEN_INVALID_OR_EXPIRED',
        message: 'The access token is missing, invalid, or expired.',
      }),
      401,
      'The access token is missing, invalid, or expired.',
    ],
    [
      'REFRESH_TOKEN_INVALID_OR_EXPIRED',
      new UnauthorizedException({
        code: 'REFRESH_TOKEN_INVALID_OR_EXPIRED',
        message: 'The refresh token is invalid or expired.',
      }),
      401,
      'The refresh token is invalid or expired.',
    ],
    [
      'ACCOUNT_DISABLED',
      new ForbiddenException({
        code: 'ACCOUNT_DISABLED',
        message: 'This account is disabled.',
      }),
      403,
      'This account is disabled.',
    ],
  ])(
    'preserves explicit authentication code %s',
    (code, exception, expectedStatus, message) => {
      const { host, status, json } = createHost();

      new ApiExceptionFilter().catch(exception, host);

      expect(status).toHaveBeenCalledWith(expectedStatus);
      expect(json).toHaveBeenCalledWith({
        error: { code, message, details: [] },
      });
    },
  );
});
