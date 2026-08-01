import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Member 1 authentication API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
  });

  it('rejects an invalid registration body', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        personalEmail: 'not-an-email',
        password: 'weak',
        unexpected: true,
      })
      .expect(400);
  });

  it('protects the current-user endpoint', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
