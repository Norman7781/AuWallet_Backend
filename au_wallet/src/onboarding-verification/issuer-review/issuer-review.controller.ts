import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth-holder-account/common/decorators/current-user.decorator';
import { Roles } from '../../auth-holder-account/common/decorators/roles.decorator';
import { UserRole } from '../../auth-holder-account/common/enums/role.enum';
import { JwtAuthGuard } from '../../auth-holder-account/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth-holder-account/common/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth-holder-account/common/interfaces/authenticated-user.interface';
import { ListOnboardingRequestsDto } from './dto/list-onboarding-requests.dto';
import { ReviewOnboardingRequestDto } from './dto/review-onboarding-request.dto';
import { IssuerReviewService } from './issuer-review.service';

@Controller('issuer/onboarding-requests')
@Roles(UserRole.ISSUER_STAFF, UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class IssuerReviewController {
  constructor(private readonly issuerReview: IssuerReviewService) {}

  @Get()
  list(@Query() query: ListOnboardingRequestsDto) {
    return this.issuerReview.list(query);
  }

  @Get(':onboardingRequestId')
  get(@Param('onboardingRequestId', ParseIntPipe) onboardingRequestId: number) {
    return this.issuerReview.get(onboardingRequestId);
  }

  @Patch(':onboardingRequestId/decision')
  decide(
    @Param('onboardingRequestId', ParseIntPipe) onboardingRequestId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewOnboardingRequestDto,
  ) {
    return this.issuerReview.decide(
      onboardingRequestId,
      user.supabaseAuthId,
      dto,
    );
  }
}
