import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
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
import { CreateOnboardingRequestDto } from '../onboarding/dto/create-onboarding-request.dto';
import { IssuerConnectionService } from './issuer-connection.service';

@Controller('issuer-connections')
@Roles(UserRole.STUDENT)
@UseGuards(JwtAuthGuard, RolesGuard)
export class IssuerConnectionController {
  constructor(private readonly issuerConnections: IssuerConnectionService) {}

  @Get('me')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.issuerConnections.listConnections(
      this.requireHolderAccountId(user),
    );
  }

  @Get(':issuerCode')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('issuerCode') issuerCode: string,
  ) {
    return this.issuerConnections.getConnection(
      this.requireHolderAccountId(user),
      issuerCode,
    );
  }

  @Post(':issuerCode/verification-requests')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('issuerCode') issuerCode: string,
    @Body() dto: CreateOnboardingRequestDto,
  ) {
    return this.issuerConnections.submitVerification(
      this.requireHolderAccountId(user),
      issuerCode,
      dto,
    );
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
