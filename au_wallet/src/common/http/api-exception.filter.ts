import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

interface ExceptionBody {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'AUTHENTICATION_REQUIRED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
};

const MESSAGE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'The request is invalid.',
  [HttpStatus.UNAUTHORIZED]: 'Authentication is required.',
  [HttpStatus.FORBIDDEN]: 'You do not have permission for this action.',
  [HttpStatus.NOT_FOUND]: 'The requested resource was not found.',
  [HttpStatus.CONFLICT]: 'The request conflicts with the current state.',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'An internal error occurred.',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = this.getExceptionBody(exception);
    const details = this.getValidationDetails(exceptionBody);
    const explicitCode = this.getStableCode(exceptionBody.code);
    const explicitMessage = explicitCode
      ? this.getSafeExplicitMessage(exceptionBody.message)
      : null;

    response.status(status).json({
      error: {
        code: explicitCode ?? CODE_BY_STATUS[status] ?? 'HTTP_ERROR',
        message:
          details.length > 0
            ? 'Request validation failed.'
            : (explicitMessage ??
              MESSAGE_BY_STATUS[status] ??
              'The request could not be completed.'),
        details,
      },
    });
  }

  private getExceptionBody(exception: unknown): ExceptionBody {
    if (!(exception instanceof HttpException)) {
      return {};
    }

    const body = exception.getResponse();

    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return body;
    }

    return {};
  }

  private getValidationDetails(body: ExceptionBody): string[] {
    if (!Array.isArray(body.message)) {
      return [];
    }

    return body.message.filter(
      (message): message is string => typeof message === 'string',
    );
  }

  private getStableCode(code: unknown): string | null {
    return typeof code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(code)
      ? code
      : null;
  }

  private getSafeExplicitMessage(message: unknown): string | null {
    return typeof message === 'string' && message.length <= 200
      ? message
      : null;
  }
}
