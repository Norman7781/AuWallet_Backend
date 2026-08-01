import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createServer } from 'node:net';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/environment';

const logger = new Logger('Bootstrap');

async function findAvailablePort(startingPort: number): Promise<number> {
  for (let port = startingPort; port <= 65535; port += 1) {
    const isAvailable = await new Promise<boolean>((resolve, reject) => {
      const server = createServer();

      server.once('error', (error: NodeJS.ErrnoException) => {
        server.close();

        if (error.code === 'EADDRINUSE') {
          resolve(false);
          return;
        }

        reject(error);
      });

      server.once('listening', () => {
        server.close(() => resolve(true));
      });

      server.listen(port, '::');
    });

    if (isAvailable) {
      return port;
    }
  }

  throw new Error('No available port found');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  const requestedPort = configService.get('PORT', { infer: true });
  const port = await findAvailablePort(requestedPort);

  if (port !== requestedPort) {
    logger.warn(
      `PORT ${requestedPort} is in use, starting on the next available port ${port}`,
    );
  }

  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
}

void bootstrap();
