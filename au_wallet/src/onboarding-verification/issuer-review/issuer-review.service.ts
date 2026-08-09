import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListOnboardingRequestsDto } from './dto/list-onboarding-requests.dto';
import {
  IssuerReviewDecision,
  ReviewOnboardingRequestDto,
} from './dto/review-onboarding-request.dto';
import {
  IssuerOnboardingRequestListResponse,
  IssuerOnboardingRequestRecord,
  IssuerOnboardingRequestResponse,
  PublicIssuerOnboardingRequest,
} from './issuer-onboarding-request.interface';
import { IssuerOnboardingRequestRepository } from './issuer-onboarding-request.repository';
import {
  AcademicStatus,
  AcademicReviewContext,
} from '../student-matching/academic-student-record.interface';
import { AcademicStudentRepository } from '../student-matching/academic-student.repository';
import { OnboardingApprovalFinalizer } from '../onboarding/verified-onboarding-finalizer';
import { OnboardingRejectionFinalizer } from '../onboarding/verified-onboarding-finalizer';

const ELIGIBLE_STATUSES = new Set<AcademicStatus>([
  'studying',
  'graduated',
  'alumni',
]);

@Injectable()
export class IssuerReviewService {
  constructor(
    private readonly requests: IssuerOnboardingRequestRepository,
    private readonly academics: AcademicStudentRepository,
    private readonly approvalFinalizer: OnboardingApprovalFinalizer,
    private readonly rejectionFinalizer: OnboardingRejectionFinalizer,
  ) {}

  async list(
    query: ListOnboardingRequestsDto,
  ): Promise<IssuerOnboardingRequestListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.requests.listUnderReview(page, limit);
    const contexts = await this.loadContexts(result.records);

    return {
      data: result.records.map((record) =>
        this.toPublic(record, this.contextFor(record, contexts)),
      ),
      message: 'Issuer verification review queue loaded.',
      meta: { page, limit, total: result.total },
    };
  }

  async get(
    onboardingRequestId: number,
  ): Promise<IssuerOnboardingRequestResponse> {
    const record = await this.requireRequest(onboardingRequestId);
    const contexts = await this.loadContexts([record]);

    return {
      data: this.toPublic(record, this.contextFor(record, contexts)),
      message: 'Issuer verification request loaded.',
      meta: {},
    };
  }

  async decide(
    onboardingRequestId: number,
    reviewedBy: string,
    dto: ReviewOnboardingRequestDto,
  ): Promise<IssuerOnboardingRequestResponse> {
    const record = await this.requireRequest(onboardingRequestId);

    if (dto.decision === IssuerReviewDecision.APPROVE) {
      return this.approve(record, reviewedBy);
    }

    if (record.verificationStatus !== 'under_review') {
      throw new ConflictException({
        code: 'ISSUER_VERIFICATION_ALREADY_DECIDED',
        message: 'This issuer verification is no longer under review.',
      });
    }

    if (!dto.rejectionReason) {
      throw new BadRequestException(
        'A controlled rejection reason is required',
      );
    }

    const rejectedResult = await this.rejectionFinalizer.reject({
      onboardingRequestId,
      reviewedBy,
      rejectionReason: dto.rejectionReason,
    });
    const rejected: IssuerOnboardingRequestRecord = {
      ...record,
      verificationStatus: rejectedResult.verificationStatus,
      matchedEnrollmentId: rejectedResult.matchedEnrollmentId,
      reviewedAt: rejectedResult.reviewedAt,
      rejectionReason: rejectedResult.rejectionReason,
    };

    return {
      data: this.toPublic(rejected, await this.loadContextForRecord(rejected)),
      message: 'Issuer verification rejected.',
      meta: {},
    };
  }

  private async requireRequest(
    onboardingRequestId: number,
  ): Promise<IssuerOnboardingRequestRecord> {
    const record = await this.requests.findById(onboardingRequestId);

    if (!record) {
      throw new NotFoundException('Onboarding request was not found');
    }

    return record;
  }

  private toPublic(
    record: IssuerOnboardingRequestRecord,
    context: AcademicReviewContext | null,
  ): PublicIssuerOnboardingRequest {
    const exactEligibleCandidate = this.hasExactEligibleCandidate(
      record,
      context,
    );
    const canApprove =
      record.verificationStatus === 'under_review' && exactEligibleCandidate;
    const isGraduated =
      context?.academicStatus === 'graduated' ||
      context?.academicStatus === 'alumni';

    return {
      onboardingRequestId: record.onboardingRequestId,
      holderAccountId: record.holderAccountId,
      admissionNo: record.admissionNo,
      dateOfBirth: record.dateOfBirth,
      verificationStatus: record.verificationStatus,
      systemMatch: exactEligibleCandidate
        ? 'exact_eligible_candidate'
        : 'not_confirmed',
      canApprove,
      academicReview: context
        ? {
            studentName: context.studentName,
            admissionNo: context.admissionNo,
            dateOfBirth: context.dateOfBirth,
            degreeName: context.degreeName,
            major: context.major,
            majorConcentration: context.majorConcentration,
            admissionDate: context.admissionDate,
            academicStatus: context.academicStatus,
            officialGraduationDate: isGraduated
              ? context.officialGraduationDate
              : null,
          }
        : null,
      reviewedAt: record.reviewedAt,
      rejectionReason: record.rejectionReason,
      submittedAt: record.submittedAt,
    };
  }

  private async approve(
    record: IssuerOnboardingRequestRecord,
    reviewedBy: string,
  ): Promise<IssuerOnboardingRequestResponse> {
    if (record.verificationStatus !== 'under_review') {
      throw new ConflictException({
        code: 'ISSUER_VERIFICATION_ALREADY_DECIDED',
        message: 'This issuer verification is no longer under review.',
      });
    }

    const context = await this.loadContextForRecord(record);

    if (!this.canApprove(record, context)) {
      throw new ConflictException({
        code: 'ISSUER_VERIFICATION_NOT_APPROVABLE',
        message: 'This issuer verification cannot be approved.',
      });
    }

    const approved = await this.approvalFinalizer.approve({
      onboardingRequestId: record.onboardingRequestId,
      reviewedBy,
    });
    const approvedRecord: IssuerOnboardingRequestRecord = {
      ...record,
      verificationStatus: approved.verificationStatus,
      matchedEnrollmentId: approved.matchedEnrollmentId,
      reviewedAt: approved.reviewedAt,
      rejectionReason: approved.rejectionReason,
    };

    return {
      data: this.toPublic(approvedRecord, context),
      message: 'Issuer connection verified.',
      meta: {},
    };
  }

  private canApprove(
    record: IssuerOnboardingRequestRecord,
    context: AcademicReviewContext | null,
  ): boolean {
    return (
      record.verificationStatus === 'under_review' &&
      this.hasExactEligibleCandidate(record, context)
    );
  }

  private hasExactEligibleCandidate(
    record: IssuerOnboardingRequestRecord,
    context: AcademicReviewContext | null,
  ): boolean {
    return Boolean(
      record.matchedEnrollmentId !== null &&
      context &&
      context.enrollmentId === record.matchedEnrollmentId &&
      context.admissionNo === record.admissionNo &&
      context.dateOfBirth === record.dateOfBirth &&
      ELIGIBLE_STATUSES.has(context.academicStatus),
    );
  }

  private async loadContexts(
    records: IssuerOnboardingRequestRecord[],
  ): Promise<Map<number, AcademicReviewContext>> {
    return this.academics.findReviewContexts(
      records.flatMap((record) =>
        record.matchedEnrollmentId === null ? [] : [record.matchedEnrollmentId],
      ),
    );
  }

  private contextFor(
    record: IssuerOnboardingRequestRecord,
    contexts: Map<number, AcademicReviewContext>,
  ): AcademicReviewContext | null {
    return record.matchedEnrollmentId === null
      ? null
      : (contexts.get(record.matchedEnrollmentId) ?? null);
  }

  private async loadContextForRecord(
    record: IssuerOnboardingRequestRecord,
  ): Promise<AcademicReviewContext | null> {
    const contexts = await this.loadContexts([record]);

    return this.contextFor(record, contexts);
  }
}
