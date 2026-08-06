import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOnboardingRequestDto } from './dto/create-onboarding-request.dto';
import {
  OnboardingRequestRecord,
  OnboardingRequestResponse,
  PublicOnboardingRequest,
} from './onboarding-request.interface';
import { OnboardingRequestRepository } from './onboarding-request.repository';
import { StudentMatchingService } from '../student-matching/student-matching.service';

const ACTIVE_REQUEST_STATUSES = new Set([
  'submitted',
  'under_review',
  'matched',
]);

const GENERIC_REJECTION_REASON = 'ONBOARDING_REQUIREMENTS_NOT_MET';
const REVIEW_MESSAGE = 'Onboarding request submitted for issuer review.';
const INELIGIBLE_MESSAGE =
  'The onboarding request does not meet wallet eligibility requirements.';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly requests: OnboardingRequestRepository,
    private readonly studentMatching: StudentMatchingService,
  ) {}

  async submit(
    holderAccountId: number,
    dto: CreateOnboardingRequestDto,
  ): Promise<OnboardingRequestResponse> {
    const existing =
      await this.requests.findLatestByHolderAccountId(holderAccountId);

    if (existing && ACTIVE_REQUEST_STATUSES.has(existing.verificationStatus)) {
      throw new ConflictException({
        code: 'ONBOARDING_REQUEST_ACTIVE',
        message: 'An active onboarding request already exists.',
      });
    }

    const admissionNo = dto.admissionNo.trim();
    const dateOfBirth = dto.dateOfBirth.trim();
    const prepared = await this.studentMatching.prepareAndMatch(dto);
    const ineligible = prepared.result.outcome === 'ineligible';
    const matchedEnrollmentId =
      prepared.result.outcome === 'matched'
        ? prepared.result.enrollmentId
        : null;
    const request = await this.requests.createRequest({
      holderAccountId,
      admissionNo,
      dateOfBirth,
      passportNumberHmac: prepared.passportNumberHmac,
      verificationStatus: ineligible ? 'rejected' : 'under_review',
      matchedEnrollmentId,
      rejectionReason: ineligible ? GENERIC_REJECTION_REASON : null,
    });

    return this.toResponse(
      request,
      ineligible ? INELIGIBLE_MESSAGE : REVIEW_MESSAGE,
    );
  }

  async getMine(holderAccountId: number): Promise<OnboardingRequestResponse> {
    const request =
      await this.requests.findLatestByHolderAccountId(holderAccountId);

    if (!request) {
      throw new NotFoundException('No onboarding request was found');
    }

    return this.toResponse(request, 'Onboarding request loaded.');
  }

  private toResponse(
    request: OnboardingRequestRecord,
    message: string,
  ): OnboardingRequestResponse {
    const data: PublicOnboardingRequest = {
      onboardingRequestId: request.onboardingRequestId,
      verificationStatus: request.verificationStatus,
      rejectionReason: request.rejectionReason,
      reviewedAt: request.reviewedAt,
      submittedAt: request.submittedAt,
    };

    return { data, message, meta: {} };
  }
}
