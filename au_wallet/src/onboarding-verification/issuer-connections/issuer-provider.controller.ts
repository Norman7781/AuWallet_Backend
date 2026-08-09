import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth-holder-account/common/decorators/current-user.decorator';
import { Roles } from '../../auth-holder-account/common/decorators/roles.decorator';
import { UserRole } from '../../auth-holder-account/common/enums/role.enum';
import { AccountStatus } from '../../auth-holder-account/common/enums/account-status.enum';
import { JwtAuthGuard } from '../../auth-holder-account/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth-holder-account/common/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth-holder-account/common/interfaces/authenticated-user.interface';
import { IssuerConnectionService } from './issuer-connection.service';

@Controller('issuer-providers')
@Roles(UserRole.STUDENT)
@UseGuards(JwtAuthGuard, RolesGuard)
export class IssuerProviderController {
  constructor(private readonly issuerConnections: IssuerConnectionService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.issuerConnections.listProviders(
      this.requireHolderAccountId(user),
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
