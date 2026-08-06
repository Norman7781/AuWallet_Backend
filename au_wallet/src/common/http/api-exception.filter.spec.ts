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
});
