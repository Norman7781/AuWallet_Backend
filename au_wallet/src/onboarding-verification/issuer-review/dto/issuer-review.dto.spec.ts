import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { ListOnboardingRequestsDto } from './list-onboarding-requests.dto';
import {
  IssuerRejectionReason,
  IssuerReviewDecision,
  ReviewOnboardingRequestDto,
} from './review-onboarding-request.dto';

function pipe() {
  return new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
  });
}

function metadata(metatype: ArgumentMetadata['metatype']): ArgumentMetadata {
  return { type: 'body', metatype };
}

describe('Issuer review DTOs', () => {
  it('transforms and validates queue pagination', async () => {
    await expect(
      pipe().transform(
        { page: '2', limit: '25' },
        metadata(ListOnboardingRequestsDto),
      ),
    ).resolves.toEqual({ page: 2, limit: 25 });
  });

  it('rejects unsafe queue limits', async () => {
    await expect(
      pipe().transform(
        { page: '1', limit: '101' },
        metadata(ListOnboardingRequestsDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts an approval decision without requiring a rejection reason', async () => {
    await expect(
      pipe().transform(
        { decision: IssuerReviewDecision.APPROVE },
        metadata(ReviewOnboardingRequestDto),
      ),
    ).resolves.toEqual({ decision: IssuerReviewDecision.APPROVE });
  });

  it('requires the controlled reason when rejecting', async () => {
    await expect(
      pipe().transform(
        { decision: IssuerReviewDecision.REJECT },
        metadata(ReviewOnboardingRequestDto),
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      pipe().transform(
        {
          decision: IssuerReviewDecision.REJECT,
          rejectionReason:
            IssuerRejectionReason.IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED,
        },
        metadata(ReviewOnboardingRequestDto),
      ),
    ).resolves.toBeInstanceOf(ReviewOnboardingRequestDto);
  });
});
