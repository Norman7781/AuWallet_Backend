import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';
import { ApiResponseInterceptor } from './api-response.interceptor';

export function configureHttpApplication(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
}
