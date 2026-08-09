import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/environment';
import { configureHttpApplication } from './common/http/configure-http-application';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  configureHttpApplication(app);

  app.enableCors({
    origin: [
      configService.get('ISSUER_UI_ORIGIN', { infer: true }),
      configService.get('WALLET_UI_ORIGIN', { infer: true }),
    ],
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
  });

  const port = configService.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: ${await app.getUrl()}`);
}

void bootstrap();
