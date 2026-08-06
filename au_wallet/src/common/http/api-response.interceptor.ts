import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface PartialApiResponse {
  data?: unknown;
  message?: unknown;
  meta?: unknown;
}

export interface ApiSuccessEnvelope {
  data: unknown;
  message: string;
  meta: Record<string, unknown>;
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor<
  unknown,
  ApiSuccessEnvelope
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessEnvelope> {
    return next.handle().pipe(map((value) => this.toEnvelope(value)));
  }

  private toEnvelope(value: unknown): ApiSuccessEnvelope {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const response = value as PartialApiResponse;

      if ('data' in response || 'message' in response || 'meta' in response) {
        return {
          data: 'data' in response ? response.data : null,
          message:
            typeof response.message === 'string'
              ? response.message
              : 'Request completed successfully.',
          meta:
            response.meta &&
            typeof response.meta === 'object' &&
            !Array.isArray(response.meta)
              ? (response.meta as Record<string, unknown>)
              : {},
        };
      }
    }

    return {
      data: value ?? null,
      message: 'Request completed successfully.',
      meta: {},
    };
  }
}
