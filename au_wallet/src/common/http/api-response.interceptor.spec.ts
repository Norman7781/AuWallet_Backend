import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';

describe('ApiResponseInterceptor', () => {
  const interceptor = new ApiResponseInterceptor();
  const context = {} as ExecutionContext;

  it('preserves an existing safe success envelope', async () => {
    const response = await lastValueFrom(
      interceptor.intercept(context, {
        handle: () =>
          of({
            data: { status: 'under_review' },
            message: 'Loaded.',
            meta: {},
          }),
      } as CallHandler),
    );

    expect(response).toEqual({
      data: { status: 'under_review' },
      message: 'Loaded.',
      meta: {},
    });
  });

  it('wraps a plain controller result in the shared success envelope', async () => {
    const response = await lastValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ status: 'ok' }),
      } as CallHandler),
    );

    expect(response).toEqual({
      data: { status: 'ok' },
      message: 'Request completed successfully.',
      meta: {},
    });
  });
});
