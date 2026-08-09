import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth-holder-account/common/decorators/current-user.decorator';
import { Roles } from '../../auth-holder-account/common/decorators/roles.decorator';
import { UserRole } from '../../auth-holder-account/common/enums/role.enum';
import { AccountStatus } from '../../auth-holder-account/common/enums/account-status.enum';
import { JwtAuthGuard } from '../../auth-holder-account/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth-holder-account/common/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth-holder-account/common/interfaces/authenticated-user.interface';
import { CreateOnboardingRequestDto } from './dto/create-onboarding-request.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding-verification/requests')
@Roles(UserRole.STUDENT)
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post()
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOnboardingRequestDto,
  ) {
    return this.onboarding.submit(this.requireHolderAccountId(user), dto);
  }

  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.getMine(this.requireHolderAccountId(user));
  }

  private requireHolderAccountId(user: AuthenticatedUser): number {
    if (
      user.holderAccountId === null ||
      user.accountStatus !== AccountStatus.ACTIVE
    ) {
      throw new ForbiddenException({
        code: 'ACCOUNT_DISABLED',
        message: 'This account cannot currently use wallet services.',
      });
    }

    return user.holderAccountId;
  }
}
