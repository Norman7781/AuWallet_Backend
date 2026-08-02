import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { CreateOnboardingRequestDto } from './create-onboarding-request.dto';

const metadata: ArgumentMetadata = {
  type: 'body',
  metatype: CreateOnboardingRequestDto,
};

function createPipe() {
  return new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
  });
}

describe('CreateOnboardingRequestDto', () => {
  const validPayload = {
    admissionNo: 'DEMO-ADMISSION-001',
    dateOfBirth: '2001-02-03',
    passportNumber: 'synthetic-passport-input',
  };

  it('accepts exactly the three automatic matching inputs without a document', async () => {
    const result: unknown = await createPipe().transform(
      validPayload,
      metadata,
    );

    expect(result).toEqual(validPayload);
    expect(result).toBeInstanceOf(CreateOnboardingRequestDto);
  });

  it('requires an ISO date of birth', async () => {
    await expect(
      createPipe().transform(
        { ...validPayload, dateOfBirth: '03/02/2001' },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires a passport identifier for the HMAC match', async () => {
    const payload = {
      admissionNo: validPayload.admissionNo,
      dateOfBirth: validPayload.dateOfBirth,
    };

    await expect(createPipe().transform(payload, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it.each([
    { holderAccountId: 25 },
    { matchedEnrollmentId: 50 },
    { academicStatus: 'graduated' },
    { passportDocument: 'client-controlled-path' },
  ])('rejects client-controlled workflow fields', async (extraField) => {
    await expect(
      createPipe().transform({ ...validPayload, ...extraField }, metadata),
    ).rejects.toThrow(BadRequestException);
  });
});
