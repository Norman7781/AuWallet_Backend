import { IsDefined, IsEnum, ValidateIf } from 'class-validator';

export enum IssuerReviewDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export enum IssuerRejectionReason {
  IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED = 'IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED',
}

export class ReviewOnboardingRequestDto {
  @IsEnum(IssuerReviewDecision)
  decision!: IssuerReviewDecision;

  @ValidateIf(
    (dto: ReviewOnboardingRequestDto) =>
      dto.decision === IssuerReviewDecision.REJECT,
  )
  @IsDefined()
  @IsEnum(IssuerRejectionReason)
  rejectionReason?: IssuerRejectionReason;
}
